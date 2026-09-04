using System;
using System.IO;
using System.Text;
using System.Threading;

using Mafi;

internal sealed class SnapshotFileWriter : IDisposable
{
    private readonly object m_lock = new object();
    private readonly string m_snapshotPath;
    private string m_pendingJson;
    private bool m_writerRunning;
    private bool m_acceptWrites = true;

    public string SnapshotPath { get { return m_snapshotPath; } }

    public SnapshotFileWriter(string snapshotPath)
    {
        m_snapshotPath = snapshotPath;
    }

    public void Queue(string json)
    {
        lock (m_lock)
        {
            if (!m_acceptWrites)
            {
                return;
            }

            m_pendingJson = json;
            if (m_writerRunning)
            {
                return;
            }

            m_writerRunning = true;
        }

        ThreadPool.QueueUserWorkItem(delegate
        {
            flushPendingWrites();
        });
    }

    public void Dispose()
    {
        lock (m_lock)
        {
            m_acceptWrites = false;
            m_pendingJson = null;
        }
    }

    private void flushPendingWrites()
    {
        while (true)
        {
            string json;
            lock (m_lock)
            {
                json = m_pendingJson;
                m_pendingJson = null;
                if (json == null)
                {
                    m_writerRunning = false;
                    return;
                }
            }

            try
            {
                writeSnapshot(json);
            }
            catch (Exception ex)
            {
                Log.Info("CoI Calculator Exporter: unable to write game snapshot: " + ex);
            }
        }
    }

    private void writeSnapshot(string json)
    {
        string temporaryPath = m_snapshotPath + ".tmp";
        File.WriteAllText(temporaryPath, json, new UTF8Encoding(false));

        if (File.Exists(m_snapshotPath))
        {
            File.Replace(temporaryPath, m_snapshotPath, null);
        }
        else
        {
            File.Move(temporaryPath, m_snapshotPath);
        }
    }
}
