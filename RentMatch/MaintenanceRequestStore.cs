using System.Text.Json;
using System.Text.Json.Nodes;

namespace RentMatch;

public sealed class MaintenanceRequestStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath;
    private readonly PropertyStore _propertyStore;

    public MaintenanceRequestStore(IWebHostEnvironment environment, PropertyStore propertyStore)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dataDirectory);
        _filePath = Path.Combine(dataDirectory, "maintenance-requests.json");
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

    public async Task<(JsonObject? Request, string? Error)> CreateAsync(
        JsonObject request,
        CancellationToken cancellationToken)
    {
        var propertyId = ReadString(request, "propertyId");
        var renterName = ReadString(request, "renterName");
        var renterEmail = ReadString(request, "renterEmail");
        var category = ReadString(request, "category");
        var title = ReadString(request, "title");
        var description = ReadString(request, "description");
        var priority = ReadString(request, "priority");

        if (string.IsNullOrWhiteSpace(propertyId)
            || string.IsNullOrWhiteSpace(renterName)
            || string.IsNullOrWhiteSpace(renterEmail)
            || !renterEmail.Contains('@')
            || string.IsNullOrWhiteSpace(category)
            || string.IsNullOrWhiteSpace(title)
            || string.IsNullOrWhiteSpace(description))
        {
            return (null, "A property, renter name and email, issue title, category, and description are required.");
        }

        if (title.Length > 120 || description.Length > 1500)
        {
            return (null, "The issue title must be 120 characters or fewer and the description 1,500 characters or fewer.");
        }

        if (category is not ("Plumbing" or "Electrical" or "Appliance" or "Pest control" or "General repair" or "Other")
            || priority is not ("Routine" or "Urgent"))
        {
            return (null, "Choose a valid maintenance category and priority.");
        }

        var property = await _propertyStore.GetByIdAsync(propertyId, cancellationToken);
        if (property is null)
        {
            return (null, "The selected rental could not be found.");
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var requests = await ReadAsync(cancellationToken);
            var savedRequest = new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString("N"),
                ["propertyId"] = propertyId,
                ["propertyName"] = ReadString(property, "name") ?? "Rental property",
                ["landlordEmail"] = ReadString(property, "ownerEmail") ?? ReadString(property, "hostEmail") ?? "",
                ["landlordName"] = ReadString(property, "host") ?? "Property host",
                ["renterName"] = renterName.Trim(),
                ["renterEmail"] = renterEmail.Trim(),
                ["category"] = category,
                ["title"] = title.Trim(),
                ["description"] = description.Trim(),
                ["priority"] = priority,
                ["status"] = "Received",
                ["createdAt"] = DateTimeOffset.UtcNow.ToString("O")
            };
            requests.Insert(0, savedRequest);
            await WriteAsync(requests, cancellationToken);
            return ((JsonObject)savedRequest.DeepClone(), null);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<JsonObject?> UpdateStatusAsync(
        string id,
        string status,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var requests = await ReadAsync(cancellationToken);
            var request = requests.FirstOrDefault(item =>
                string.Equals(ReadString(item, "id"), id, StringComparison.Ordinal));
            if (request is null)
            {
                return null;
            }

            request["status"] = status;
            await WriteAsync(requests, cancellationToken);
            return (JsonObject)request.DeepClone();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<(bool Found, bool Deleted)> DeleteAsync(
        string id,
        string renterEmail,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var requests = await ReadAsync(cancellationToken);
            var request = requests.FirstOrDefault(item =>
                string.Equals(ReadString(item, "id"), id, StringComparison.Ordinal));
            if (request is null)
            {
                return (false, false);
            }

            if (!string.Equals(ReadString(request, "renterEmail"), renterEmail, StringComparison.OrdinalIgnoreCase))
            {
                return (true, false);
            }

            requests.Remove(request);
            await WriteAsync(requests, cancellationToken);
            return (true, true);
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

    private async Task WriteAsync(List<JsonObject> requests, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(requests, JsonOptions);
        await File.WriteAllTextAsync(temporaryPath, json, cancellationToken);
        File.Move(temporaryPath, _filePath, overwrite: true);
    }

    private static string? ReadString(JsonObject value, string key) =>
        value[key] is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var text) ? text : null;
}
