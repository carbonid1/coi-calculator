using System;
using System.Globalization;
using System.Text;

using Mafi.Serialization;

// The snapshot's JSON boundary. Field writers do not manage separators or escaping.
internal sealed class SnapshotJsonStream
{
    private readonly StringBuilder m_json;
    private bool m_needsComma;
    private string m_lastName;

    public SnapshotJsonStream(int capacity)
    {
        m_json = new StringBuilder(capacity);
    }

    public SnapshotJsonStream BeginObject() { return begin('{'); }
    public SnapshotJsonStream EndObject() { return end('}'); }
    public SnapshotJsonStream BeginArray() { return begin('['); }
    public SnapshotJsonStream EndArray() { return end(']'); }

    public SnapshotJsonStream Name(string name)
    {
        m_lastName = name;
        appendComma();
        appendString(name);
        m_json.Append(':');
        m_needsComma = false;
        return this;
    }

    public SnapshotJsonStream Value(string value)
    {
        appendComma();
        if (value == null) m_json.Append("null");
        else appendString(value);
        return this;
    }

    public SnapshotJsonStream Value(bool value)
    {
        appendComma();
        m_json.Append(value ? "true" : "false");
        return this;
    }

    public SnapshotJsonStream Value(long value)
    {
        appendComma();
        m_json.Append(value.ToString(CultureInfo.InvariantCulture));
        return this;
    }

    public SnapshotJsonStream Value(double value)
    {
        // NaN and Infinity are not JSON; one of them makes the whole reply unreadable.
        if (double.IsNaN(value) || double.IsInfinity(value))
        {
            throw new InvalidOperationException(
                "Non-finite number in field \"" + (m_lastName ?? "?") + "\".");
        }
        appendComma();
        m_json.Append(value.ToString("R", CultureInfo.InvariantCulture));
        return this;
    }

    public void Field(string name, string value) { Name(name).Value(value); }
    public void Field(string name, bool value) { Name(name).Value(value); }
    public void Field(string name, long value) { Name(name).Value(value); }
    public void Field(string name, double value) { Name(name).Value(value); }

    public string GetJson() { return m_json.ToString(); }

    private SnapshotJsonStream begin(char bracket)
    {
        appendComma();
        m_json.Append(bracket);
        m_needsComma = false;
        return this;
    }

    private SnapshotJsonStream end(char bracket)
    {
        m_json.Append(bracket);
        m_needsComma = true;
        return this;
    }

    private void appendComma()
    {
        if (m_needsComma) m_json.Append(',');
        m_needsComma = true;
    }

    private void appendString(string value)
    {
        m_json.Append('"');
        // The game's escaper drops CR. Preserve it without changing saved titles
        // or duplicating the game's handling of other JSON control characters.
        int start = 0;
        for (int index = value.IndexOf('\r'); index >= 0; index = value.IndexOf('\r', start))
        {
            JsonWriter.JsonEscapeString(value.Substring(start, index - start), m_json);
            m_json.Append("\\r");
            start = index + 1;
        }
        JsonWriter.JsonEscapeString(start == 0 ? value : value.Substring(start), m_json);
        m_json.Append('"');
    }
}

