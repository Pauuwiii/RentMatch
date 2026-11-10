using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace RentMatch;

public sealed class ViewingStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath;
    private readonly PropertyStore _propertyStore;

    public ViewingStore(IWebHostEnvironment environment, PropertyStore propertyStore)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dataDirectory);
        _filePath = Path.Combine(dataDirectory, "viewings.json");
        _propertyStore = propertyStore;
    }

    public async Task<IReadOnlyList<JsonObject>> GetAllAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return await ReadAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<(JsonObject? Viewing, string? Error)> CreateAsync(
        JsonObject viewing,
        CancellationToken cancellationToken)
    {
        var propertyId = ReadString(viewing, "propertyId");
        var renterName = ReadString(viewing, "renterName");
        var renterEmail = ReadString(viewing, "renterEmail");
        var date = ReadString(viewing, "date");
        var requestedTime = ReadString(viewing, "requestedTime");
        var renterMessage = ReadString(viewing, "renterMessage");

        if (string.IsNullOrWhiteSpace(propertyId)
            || string.IsNullOrWhiteSpace(renterName)
            || string.IsNullOrWhiteSpace(renterEmail)
            || !renterEmail.Contains('@')
            || !DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            || !TimeOnly.TryParseExact(requestedTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            || string.IsNullOrWhiteSpace(renterMessage))
        {
            return (null, "A property, renter name and email, valid date and time, and message are required.");
        }

        if (renterName.Length > 120 || renterEmail.Length > 254 || renterMessage.Length > 1000)
        {
            return (null, "The renter name, email, or message exceeds the allowed length.");
        }

        if (DateOnly.ParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture) < DateOnly.FromDateTime(DateTime.Today))
        {
            return (null, "Choose a viewing date that is today or later.");
        }

        var property = await _propertyStore.GetByIdAsync(propertyId, cancellationToken);
        if (property is null)
        {
            return (null, "The selected rental could not be found.");
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var viewings = await ReadAsync(cancellationToken);
            if (viewings.Any(item =>
                string.Equals(ReadString(item, "propertyId"), propertyId, StringComparison.Ordinal)
                && string.Equals(ReadString(item, "date"), date, StringComparison.Ordinal)))
            {
                return (null, "A viewing has already been requested for this property and date. Choose another date.");
            }

            var savedViewing = new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString("N"),
                ["propertyId"] = propertyId,
                ["propertyName"] = ReadString(property, "name") ?? "Rental property",
                ["date"] = date,
                ["time"] = requestedTime,
                ["requestedTime"] = requestedTime,
                ["renterName"] = renterName.Trim(),
                ["renterEmail"] = renterEmail.Trim(),
                ["hostName"] = ReadString(property, "host") ?? "Property host",
                ["hostEmail"] = ReadString(property, "ownerEmail") ?? ReadString(property, "hostEmail") ?? "",
                ["renterMessage"] = renterMessage.Trim(),
                ["status"] = "Pending"
            };
            viewings.Insert(0, savedViewing);
            await WriteAsync(viewings, cancellationToken);
            return ((JsonObject)savedViewing.DeepClone(), null);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<(JsonObject? Viewing, string? Error)> UpdateResponseAsync(
        string id,
        string status,
        string hostComment,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var viewings = await ReadAsync(cancellationToken);
            var viewing = viewings.FirstOrDefault(item =>
                string.Equals(ReadString(item, "id"), id, StringComparison.Ordinal));
            if (viewing is null)
            {
                return (null, null);
            }

            viewing["status"] = status;
            viewing["hostComment"] = hostComment.Trim();
            viewing["hostRespondedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await WriteAsync(viewings, cancellationToken);
            return ((JsonObject)viewing.DeepClone(), null);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<List<JsonObject>> ReadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_filePath))
        {
            return [];
        }

        var json = await File.ReadAllTextAsync(_filePath, cancellationToken);
        return JsonSerializer.Deserialize<List<JsonObject>>(json) ?? [];
    }

    private async Task WriteAsync(List<JsonObject> viewings, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(viewings, JsonOptions);
        await File.WriteAllTextAsync(temporaryPath, json, cancellationToken);
        File.Move(temporaryPath, _filePath, overwrite: true);
    }

    private static string? ReadString(JsonObject value, string key) =>
        value[key] is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var text) ? text : null;
}
