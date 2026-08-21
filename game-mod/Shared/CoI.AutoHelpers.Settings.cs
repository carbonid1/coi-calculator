// Cooperative Captain of Industry mod-settings host.
// Compatible with CoI.AutoHelpers.Settings by Kayser.
// Copyright (c) 2026 Kayser. Licensed under the MIT License.

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

using Mafi;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;
using UnityEngine;

namespace CoI.AutoHelpers.Settings
{
    public sealed class ModSettingsTab
    {
        public string ModId { get; private set; }
        public LocStrFormatted ModName { get; private set; }
        public LocStrFormatted Title { get; private set; }
        public int Order { get; private set; }
        public string IconAssetPath { get; private set; }
        public string ModIconAssetPath { get; private set; }
        public Func<UiComponent> BuildContent { get; private set; }

        public ModSettingsTab(
            string modId,
            LocStrFormatted modName,
            LocStrFormatted title,
            int order,
            Func<UiComponent> buildContent,
            string iconAssetPath = null,
            string modIconAssetPath = null)
        {
            if (buildContent == null)
            {
                throw new ArgumentNullException("buildContent");
            }

            ModId = modId ?? string.Empty;
            ModName = modName;
            Title = title;
            Order = order;
            IconAssetPath = iconAssetPath;
            ModIconAssetPath = modIconAssetPath;
            BuildContent = buildContent;
        }
    }

    public static class ModSettings
    {
        private const string HostObjectName = "CoI.AutoHelpers.ModSettingsHost";
        private const string HostTypeName =
            "CoI.AutoHelpers.Settings.ModSettingsHostMb";

        private static readonly List<ModSettingsTab> s_pendingTabs =
            new List<ModSettingsTab>();
        private static ModSettingsHostMb s_localHost;

        public static void EnsureInitialized(
            HudController hudController,
            UiRoot uiRoot,
            IRootEscapeManager escapeManager)
        {
            object externalHost;
            if (tryFindExternalHost(out externalHost))
            {
                invokeInitialize(
                    externalHost,
                    hudController,
                    uiRoot,
                    escapeManager);
                flushPendingTabs();
                return;
            }

            if (s_localHost == null)
            {
                GameObject hostObject = GameObject.Find(HostObjectName);
                if (hostObject == null)
                {
                    hostObject = new GameObject(HostObjectName);
                    UnityEngine.Object.DontDestroyOnLoad(hostObject);
                }

                s_localHost = hostObject.GetComponent<ModSettingsHostMb>();
                if (s_localHost == null)
                {
                    s_localHost = hostObject.AddComponent<ModSettingsHostMb>();
                }
            }

            s_localHost.Initialize(hudController, uiRoot, escapeManager);
            flushPendingTabs();
        }

        public static void RegisterTab(ModSettingsTab tab)
        {
            if (tab == null)
            {
                return;
            }

            object externalHost;
            if (tryFindExternalHost(out externalHost))
            {
                invokeRegisterTab(externalHost, tab);
            }
            else if (s_localHost != null)
            {
                s_localHost.RegisterTab(tab);
            }
            else
            {
                s_pendingTabs.Add(tab);
            }
        }

        internal static LocStrFormatted Loc(string idSuffix, string text)
        {
            return LocalizationManager.CreateAlreadyLocalizedStr(
                "CoI_AutoHelpers_ModSettings_" + idSuffix,
                text).AsFormatted;
        }

        private static void flushPendingTabs()
        {
            if (s_pendingTabs.Count == 0)
            {
                return;
            }

            ModSettingsTab[] tabs = s_pendingTabs.ToArray();
            s_pendingTabs.Clear();
            for (int i = 0; i < tabs.Length; i++)
            {
                RegisterTab(tabs[i]);
            }
        }

        private static bool tryFindExternalHost(out object host)
        {
            host = null;
            GameObject hostObject = GameObject.Find(HostObjectName);
            if (hostObject == null)
            {
                return false;
            }

            MonoBehaviour[] components = hostObject.GetComponents<MonoBehaviour>();
            for (int i = 0; i < components.Length; i++)
            {
                MonoBehaviour component = components[i];
                if (component == null)
                {
                    continue;
                }

                Type componentType = component.GetType();
                if (componentType.FullName == HostTypeName
                    && componentType.Assembly != typeof(ModSettings).Assembly)
                {
                    host = component;
                    return true;
                }
            }

            return false;
        }

        private static void invokeInitialize(
            object host,
            HudController hudController,
            UiRoot uiRoot,
            IRootEscapeManager escapeManager)
        {
            MethodInfo initialize = host.GetType().GetMethod(
                "Initialize",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (initialize == null)
            {
                throw new MissingMethodException(
                    host.GetType().FullName,
                    "Initialize");
            }

            initialize.Invoke(
                host,
                new object[] { hudController, uiRoot, escapeManager });
        }

        private static void invokeRegisterTab(object host, ModSettingsTab tab)
        {
            Type hostType = host.GetType();
            Type builderType = typeof(Func<UiComponent>);
            MethodInfo register = hostType.GetMethod(
                "RegisterExternalTab",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new Type[]
                {
                    typeof(string),
                    typeof(LocStrFormatted),
                    typeof(LocStrFormatted),
                    typeof(int),
                    builderType,
                    typeof(string),
                    typeof(string)
                },
                null);
            if (register != null)
            {
                register.Invoke(
                    host,
                    new object[]
                    {
                        tab.ModId,
                        tab.ModName,
                        tab.Title,
                        tab.Order,
                        tab.BuildContent,
                        tab.IconAssetPath ?? string.Empty,
                        tab.ModIconAssetPath ?? string.Empty
                    });
                return;
            }

            register = hostType.GetMethod(
                "RegisterExternalTab",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new Type[]
                {
                    typeof(string),
                    typeof(LocStrFormatted),
                    typeof(LocStrFormatted),
                    typeof(int),
                    builderType,
                    typeof(string)
                },
                null);
            if (register != null)
            {
                register.Invoke(
                    host,
                    new object[]
                    {
                        tab.ModId,
                        tab.ModName,
                        tab.Title,
                        tab.Order,
                        tab.BuildContent,
                        tab.IconAssetPath ?? string.Empty
                    });
                return;
            }

            register = hostType.GetMethod(
                "RegisterExternalTab",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new Type[]
                {
                    typeof(string),
                    typeof(LocStrFormatted),
                    typeof(LocStrFormatted),
                    typeof(int),
                    builderType
                },
                null);
            if (register == null)
            {
                throw new MissingMethodException(
                    hostType.FullName,
                    "RegisterExternalTab");
            }

            register.Invoke(
                host,
                new object[]
                {
                    tab.ModId,
                    tab.ModName,
                    tab.Title,
                    tab.Order,
                    tab.BuildContent
                });
        }
    }

    internal sealed class ModSettingsHostMb : MonoBehaviour, IRootEscapeHandler
    {
        private const string HudIcon =
            "Assets/Base/Terrain/Surfaces/Decals/Alphabet/M.png";

        private readonly List<ModSettingsTab> m_tabs =
            new List<ModSettingsTab>();
        private HudController m_hudController;
        private UiRoot m_uiRoot;
        private IRootEscapeManager m_escapeManager;
        private ModSettingsWindow m_window;
        private bool m_initialized;
        private bool m_buttonAdded;
        private bool m_windowOpen;
        private bool m_escapeRegistered;
        private int m_openFrame;

        public void Initialize(
            HudController hudController,
            UiRoot uiRoot,
            IRootEscapeManager escapeManager)
        {
            if (m_hudController != hudController)
            {
                m_hudController = hudController;
                m_uiRoot = uiRoot;
                m_escapeManager = escapeManager;
                m_buttonAdded = false;
                m_windowOpen = false;
                m_escapeRegistered = false;
                m_initialized = false;
            }

            if (m_window == null)
            {
                m_window = new ModSettingsWindow();
                m_window.OnCloseStart += delegate
                {
                    m_windowOpen = false;
                    clearEscapeHandler();
                };
            }

            if (!m_initialized)
            {
                m_initialized = true;
                StartCoroutine(addHudButtonDeferred());
            }
        }

        public void RegisterTab(ModSettingsTab tab)
        {
            if (tab == null)
            {
                return;
            }

            for (int i = m_tabs.Count - 1; i >= 0; i--)
            {
                ModSettingsTab existing = m_tabs[i];
                if (existing.ModId == tab.ModId
                    && existing.Title.Value == tab.Title.Value)
                {
                    m_tabs.RemoveAt(i);
                }
            }

            m_tabs.Add(tab);
            m_tabs.Sort(delegate(ModSettingsTab left, ModSettingsTab right)
            {
                int orderComparison = left.Order.CompareTo(right.Order);
                return orderComparison != 0
                    ? orderComparison
                    : string.Compare(
                        left.Title.Value,
                        right.Title.Value,
                        StringComparison.OrdinalIgnoreCase);
            });
            if (m_window != null)
            {
                m_window.RebuildTabs(m_tabs);
            }
        }

        public void RegisterExternalTab(
            string modId,
            LocStrFormatted modName,
            LocStrFormatted title,
            int order,
            Func<UiComponent> buildContent,
            string iconAssetPath,
            string modIconAssetPath)
        {
            RegisterTab(new ModSettingsTab(
                modId,
                modName,
                title,
                order,
                buildContent,
                iconAssetPath,
                modIconAssetPath));
        }

        public void RegisterExternalTab(
            string modId,
            LocStrFormatted modName,
            LocStrFormatted title,
            int order,
            Func<UiComponent> buildContent,
            string iconAssetPath)
        {
            RegisterTab(new ModSettingsTab(
                modId,
                modName,
                title,
                order,
                buildContent,
                iconAssetPath));
        }

        public void RegisterExternalTab(
            string modId,
            LocStrFormatted modName,
            LocStrFormatted title,
            int order,
            Func<UiComponent> buildContent)
        {
            RegisterTab(new ModSettingsTab(
                modId,
                modName,
                title,
                order,
                buildContent));
        }

        public void ToggleWindow()
        {
            if (m_window == null || m_uiRoot == null || m_escapeManager == null)
            {
                return;
            }

            if (m_windowOpen)
            {
                m_window.Close();
                m_windowOpen = false;
                clearEscapeHandler();
                return;
            }

            m_window.RebuildTabs(m_tabs);
            m_window.Open(m_uiRoot);
            m_window.MakeMovable();
            m_windowOpen = true;
            m_openFrame = Time.frameCount;
            m_escapeManager.AddRootEscapeHandler(this);
            m_escapeRegistered = true;
        }

        public bool OnEscape()
        {
            if (!m_windowOpen || Time.frameCount <= m_openFrame)
            {
                return false;
            }

            if (m_window != null)
            {
                m_window.Close();
            }

            m_windowOpen = false;
            clearEscapeHandler();
            return true;
        }

        private void Update()
        {
            if ((Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt))
                && Input.GetKeyDown(KeyCode.M))
            {
                ToggleWindow();
            }
        }

        private IEnumerator addHudButtonDeferred()
        {
            yield return new WaitForSeconds(2.5f);
            addHudButton();
            if (!m_buttonAdded)
            {
                yield return new WaitForSeconds(2f);
                addHudButton();
            }
        }

        private void addHudButton()
        {
            if (m_buttonAdded || m_hudController == null)
            {
                return;
            }

            try
            {
                FieldInfo calendarControlsField = typeof(HudController).GetField(
                    "m_calendarControls",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                if (calendarControlsField == null)
                {
                    return;
                }

                UiComponent root = calendarControlsField.GetValue(m_hudController)
                    as UiComponent;
                if (root == null)
                {
                    return;
                }

                UiComponent best = null;
                int bestCount = 0;
                findNodeWithMostChildren(root, ref best, ref bestCount, 0);
                if (best == null || bestCount < 3)
                {
                    return;
                }

                ButtonIconGlow button = new ButtonIconGlow(HudIcon, ToggleWindow);
                button.Tooltip(ModSettings.Loc(
                    "OpenTooltip",
                    "Open mod settings (Alt+M)"));
                best.InsertAt(0, button);
                m_buttonAdded = true;
            }
            catch (Exception exception)
            {
                UnityEngine.Debug.Log(
                    "[AutoHelpers] Mod settings HUD button failed: "
                    + exception);
            }
        }

        private static void findNodeWithMostChildren(
            UiComponent node,
            ref UiComponent best,
            ref int bestCount,
            int depth)
        {
            if (depth > 10)
            {
                return;
            }

            int childrenCount = node.ChildrenCount;
            if (childrenCount > bestCount)
            {
                best = node;
                bestCount = childrenCount;
            }

            foreach (UiComponent child in node.AllChildren)
            {
                findNodeWithMostChildren(
                    child,
                    ref best,
                    ref bestCount,
                    depth + 1);
            }
        }

        private void clearEscapeHandler()
        {
            if (m_escapeRegistered && m_escapeManager != null)
            {
                m_escapeManager.ClearRootEscapeHandler(this);
                m_escapeRegistered = false;
            }
        }
    }

    internal sealed class ModSettingsWindow : Window
    {
        private readonly Column m_tabsSlot;
        private string m_activeModId;
        private readonly Dictionary<string, int> m_activeNestedTabOrderByModId =
            new Dictionary<string, int>();

        public ModSettingsWindow()
            : base(ModSettings.Loc("Title", "Mod Settings"), false)
        {
            WindowSize(new Px(760f), new Px(720f));
            CloseOnClickOutside();
            m_tabsSlot = new Column().FlexGrow(1f).AlignItemsStretch();
            Body.Add(m_tabsSlot);
        }

        public void RebuildTabs(IReadOnlyList<ModSettingsTab> tabs)
        {
            m_tabsSlot.Clear();
            if (tabs.Count == 0)
            {
                m_tabsSlot.Add(new Label(ModSettings.Loc(
                    "NoTabs",
                    "No mod settings registered.")));
                return;
            }

            TabContainer modTabs = new TabContainer();
            Dictionary<UiComponent, string> modIdByContent =
                new Dictionary<UiComponent, string>();
            modTabs.OnTabActivate(delegate
            {
                UiComponent activeContent = modTabs.ActiveTab.ValueOrNull;
                string modId;
                if (activeContent != null
                    && modIdByContent.TryGetValue(activeContent, out modId))
                {
                    m_activeModId = modId;
                }
            });

            string requestedActiveModId = m_activeModId;
            bool restoreActiveMod = !string.IsNullOrWhiteSpace(requestedActiveModId)
                && tabs.Any(tab => tab.ModId == requestedActiveModId);
            IEnumerable<IGrouping<string, ModSettingsTab>> groups = tabs
                .GroupBy(tab => tab.ModId)
                .OrderBy(group => group.Min(tab => tab.Order));
            foreach (IGrouping<string, ModSettingsTab> group in groups)
            {
                List<ModSettingsTab> orderedTabs = group
                    .OrderBy(tab => tab.Order)
                    .ThenBy(tab => tab.Title.Value)
                    .ToList();
                if (orderedTabs.Count == 0)
                {
                    continue;
                }

                ModSettingsTab firstTab = orderedTabs[0];
                UiComponent content = orderedTabs.Count == 1
                    ? buildTabContent(firstTab)
                    : buildNestedTabs(orderedTabs);
                modIdByContent[content] = firstTab.ModId;
                modTabs.AddTab(
                    firstTab.ModName,
                    content,
                    firstTab.ModIconAssetPath ?? firstTab.IconAssetPath,
                    null,
                    restoreActiveMod && firstTab.ModId == requestedActiveModId);
            }

            m_tabsSlot.Add(modTabs);
        }

        private UiComponent buildNestedTabs(IReadOnlyList<ModSettingsTab> tabs)
        {
            TabContainer nestedTabs = new TabContainer();
            Dictionary<UiComponent, int> orderByContent =
                new Dictionary<UiComponent, int>();
            nestedTabs.OnTabActivate(delegate
            {
                UiComponent activeContent = nestedTabs.ActiveTab.ValueOrNull;
                int activeOrder;
                if (activeContent != null
                    && orderByContent.TryGetValue(activeContent, out activeOrder))
                {
                    m_activeNestedTabOrderByModId[tabs[0].ModId] = activeOrder;
                }
            });

            int rememberedOrder;
            bool restoreActiveTab = m_activeNestedTabOrderByModId.TryGetValue(
                    tabs[0].ModId,
                    out rememberedOrder)
                && tabs.Any(tab => tab.Order == rememberedOrder);
            for (int i = 0; i < tabs.Count; i++)
            {
                ModSettingsTab tab = tabs[i];
                UiComponent content = buildTabContent(tab);
                orderByContent[content] = tab.Order;
                nestedTabs.AddTab(
                    tab.Title,
                    content,
                    tab.IconAssetPath,
                    null,
                    restoreActiveTab && tab.Order == rememberedOrder,
                    false);
            }

            return nestedTabs;
        }

        private static UiComponent buildTabContent(ModSettingsTab tab)
        {
            try
            {
                return tab.BuildContent();
            }
            catch
            {
                return new Label(ModSettings.Loc(
                    "TabError",
                    "This settings tab failed to load."));
            }
        }
    }
}
