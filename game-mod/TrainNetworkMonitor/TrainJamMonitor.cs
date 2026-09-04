using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Input;
using Mafi.Core.Mods;
using Mafi.Core.Notifications;
using Mafi.Core.Simulation;
using Mafi.Core.Trains;

internal sealed class TrainJamMonitor : IDisposable
{
    internal static readonly EntityNotificationProto.ID FleetJamNotificationId =
        new EntityNotificationProto.ID("TrainNetworkMonitor_FleetJam");
    internal static readonly EntityNotificationProto.ID GroupedFleetJamNotificationId =
        new EntityNotificationProto.ID("TrainNetworkMonitor_FleetJam_Grouped");

    private readonly NotificationProto m_fleetJamNotificationProto;
    private readonly NotificationProto m_groupedFleetJamNotificationProto;
    private readonly IInputScheduler m_inputScheduler;
    private readonly TrainsManager m_trainsManager;
    private readonly INotificationsManager m_notificationsManager;
    private readonly ISimLoopEvents m_simLoopEvents;
    private readonly ModJsonConfig m_jsonConfig;
    private readonly Dictionary<TrainId, EntityNotificator> m_trainJamNotificators =
        new Dictionary<TrainId, EntityNotificator>();
    // In game version 0.8.7a, Train.ReservationWaitTime never resets after its
    // first failed reservation. Track uninterrupted UI wait states ourselves.
    private readonly Dictionary<TrainId, SimStep> m_trainWaitStartSteps =
        new Dictionary<TrainId, SimStep>();
    private readonly HashSet<TrainId> m_waitingTrainIdsThisUpdate =
        new HashSet<TrainId>();
    private readonly List<TrainId> m_waitTrackingIdsToRemove =
        new List<TrainId>();
    private bool m_isRedAlertActive;
    private bool m_pauseHandledForCurrentAlert;

    public TrainJamMonitor(
        NotificationProto fleetJamNotificationProto,
        NotificationProto groupedFleetJamNotificationProto,
        IInputScheduler inputScheduler,
        TrainsManager trainsManager,
        INotificationsManager notificationsManager,
        ISimLoopEvents simLoopEvents,
        ModJsonConfig jsonConfig)
    {
        m_fleetJamNotificationProto = fleetJamNotificationProto;
        m_groupedFleetJamNotificationProto = groupedFleetJamNotificationProto;
        m_inputScheduler = inputScheduler;
        m_trainsManager = trainsManager;
        m_notificationsManager = notificationsManager;
        m_simLoopEvents = simLoopEvents;
        m_jsonConfig = jsonConfig;
    }

    public void Update()
    {
        if (m_trainsManager == null
            || m_notificationsManager == null
            || m_simLoopEvents == null)
        {
            return;
        }

        int activeTrains = 0;
        List<SustainedTrainWait> stuckTrains = new List<SustainedTrainWait>();
        int stuckAfterCycles = Math.Min(
            TrainNetworkSettingsKeys.MaximumStuckAfterCycles,
            Math.Max(
                TrainNetworkSettingsKeys.DefaultStuckAfterCycles,
                m_jsonConfig.GetInt(TrainNetworkSettingsKeys.StuckAfterCycles)));
        Duration stuckAfter = Duration.OneMonth * stuckAfterCycles;
        SimStep currentStep = m_simLoopEvents.CurrentStep;
        m_waitingTrainIdsThisUpdate.Clear();

        foreach (Train train in m_trainsManager.Trains)
        {
            if (train.IsDestroyed
                || train.IsDespawning
                || !train.IsSpawned
                || train.IsPaused)
            {
                continue;
            }

            activeTrains++;
            if (!isWaitingForTrack(train.StateForUi))
            {
                continue;
            }

            TrainId trainId = train.TrainId;
            m_waitingTrainIdsThisUpdate.Add(trainId);

            SimStep waitStartStep;
            if (!m_trainWaitStartSteps.TryGetValue(trainId, out waitStartStep))
            {
                waitStartStep = currentStep;
                m_trainWaitStartSteps.Add(trainId, waitStartStep);
            }

            Duration waitDuration = currentStep - waitStartStep;
            if (waitDuration >= stuckAfter)
            {
                stuckTrains.Add(new SustainedTrainWait(train, waitDuration));
            }
        }

        removeCompletedTrainWaits();

        int criticalThreshold = Math.Max(3, (int)Math.Ceiling(activeTrains * 0.1));
        bool isRedAlert = stuckTrains.Count >= criticalThreshold;
        syncTrainNotifications(stuckTrains, isRedAlert);

        if (!isRedAlert)
        {
            m_pauseHandledForCurrentAlert = false;
            return;
        }

        if (m_jsonConfig.GetBool(TrainNetworkSettingsKeys.PauseOnRedAlert)
            && !m_pauseHandledForCurrentAlert)
        {
            m_pauseHandledForCurrentAlert = true;
            if (!m_simLoopEvents.IsSimPaused && m_inputScheduler != null)
            {
                m_inputScheduler.ScheduleInputCmd(new SetSimPauseStateCmd(true));
            }
        }
    }

    public void Dispose()
    {
        deactivateAllTrainNotifications();
        clearTrainWaitTracking();
        m_isRedAlertActive = false;
        m_pauseHandledForCurrentAlert = false;
    }

    private void syncTrainNotifications(
        List<SustainedTrainWait> stuckTrains,
        bool isRedAlert)
    {
        if (!isRedAlert)
        {
            deactivateAllTrainNotifications();
            m_isRedAlertActive = false;
            return;
        }

        HashSet<TrainId> stuckTrainIds = new HashSet<TrainId>();
        for (int i = 0; i < stuckTrains.Count; i++)
        {
            stuckTrainIds.Add(stuckTrains[i].Train.TrainId);
        }

        List<TrainId> notificationIdsToRemove = new List<TrainId>();
        foreach (KeyValuePair<TrainId, EntityNotificator> pair in m_trainJamNotificators)
        {
            if (!stuckTrainIds.Contains(pair.Key))
            {
                notificationIdsToRemove.Add(pair.Key);
            }
        }

        for (int i = 0; i < notificationIdsToRemove.Count; i++)
        {
            TrainId trainId = notificationIdsToRemove[i];
            EntityNotificator notificator = m_trainJamNotificators[trainId];
            notificator.Deactivate(m_notificationsManager);
            m_trainJamNotificators.Remove(trainId);
        }

        stuckTrains.Sort((left, right) =>
            right.Duration.Ticks.CompareTo(left.Duration.Ticks));

        bool shouldPlayAlertAudio = !m_isRedAlertActive;
        for (int i = 0; i < stuckTrains.Count; i++)
        {
            Train train = stuckTrains[i].Train;
            if (m_trainJamNotificators.ContainsKey(train.TrainId))
            {
                continue;
            }

            NotificationProto proto = shouldPlayAlertAudio
                ? m_fleetJamNotificationProto
                : m_groupedFleetJamNotificationProto;
            shouldPlayAlertAudio = false;
            EntityNotificator notificator = new EntityNotificator(proto);
            notificator.Activate(train, m_notificationsManager);
            m_trainJamNotificators.Add(train.TrainId, notificator);
        }

        m_isRedAlertActive = true;
    }

    private void removeCompletedTrainWaits()
    {
        m_waitTrackingIdsToRemove.Clear();
        foreach (KeyValuePair<TrainId, SimStep> pair in m_trainWaitStartSteps)
        {
            if (!m_waitingTrainIdsThisUpdate.Contains(pair.Key))
            {
                m_waitTrackingIdsToRemove.Add(pair.Key);
            }
        }

        for (int i = 0; i < m_waitTrackingIdsToRemove.Count; i++)
        {
            m_trainWaitStartSteps.Remove(m_waitTrackingIdsToRemove[i]);
        }
    }

    private void clearTrainWaitTracking()
    {
        m_trainWaitStartSteps.Clear();
        m_waitingTrainIdsThisUpdate.Clear();
        m_waitTrackingIdsToRemove.Clear();
    }

    private void deactivateAllTrainNotifications()
    {
        if (m_notificationsManager != null)
        {
            foreach (EntityNotificator notificator in m_trainJamNotificators.Values)
            {
                EntityNotificator activeNotificator = notificator;
                activeNotificator.Deactivate(m_notificationsManager);
            }
        }

        m_trainJamNotificators.Clear();
    }

    private static bool isWaitingForTrack(TrainStateForUi state)
    {
        return state == TrainStateForUi.WaitingForFreeTrack
            || state == TrainStateForUi.WaitingForSuperBlock
            || state == TrainStateForUi.WaitingForBidirectionalSuperBlock;
    }

    private struct SustainedTrainWait
    {
        public readonly Train Train;
        public readonly Duration Duration;

        public SustainedTrainWait(Train train, Duration duration)
        {
            Train = train;
            Duration = duration;
        }
    }
}
