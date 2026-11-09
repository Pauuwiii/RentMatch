using System.Text.Json;
using System.Text.Json.Nodes;

namespace RentMatch;

public sealed class ApplicationStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath;
    private readonly PropertyStore _propertyStore;

    public ApplicationStore(IWebHostEnvironment environment, PropertyStore propertyStore)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dataDirectory);
        _filePath = Path.Combine(dataDirectory, "applications.json");
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

    public async Task<(JsonObject? Application, string? Error)> CreateAsync(
        JsonObject application,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var applications = await ReadAsync(cancellationToken);
            var propertyId = application["propertyId"]?.GetValue<string>();
            var renterEmail = application["renterEmail"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(propertyId) || string.IsNullOrWhiteSpace(renterEmail))
            {
                return (null, "A property and renter email are required.");
            }

            var property = await _propertyStore.GetByIdAsync(propertyId, cancellationToken);
            if (property is null || property["available"]?.GetValue<bool>() != true
                || property["units"]?.GetValue<int>() is not > 0)
            {
                return (null, "This listing has no available slots.");
            }

            if (applications.Any(item =>
                string.Equals(item["propertyId"]?.GetValue<string>(), propertyId, StringComparison.Ordinal)
                && string.Equals(item["renterEmail"]?.GetValue<string>(), renterEmail, StringComparison.OrdinalIgnoreCase)
                && item["status"]?.GetValue<string>() is "Pending" or "Approved"))
            {
                return (null, "You already have an active application for this listing.");
            }

            var savedApplication = (JsonObject)application.DeepClone();
            savedApplication["id"] = Guid.NewGuid().ToString("N");
            savedApplication["property"] = property["name"]?.GetValue<string>() ?? "Rental listing";
            savedApplication["status"] = "Pending";
            applications.Insert(0, savedApplication);
            await WriteAsync(applications, cancellationToken);
            return ((JsonObject)savedApplication.DeepClone(), null);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<(JsonObject? Application, JsonObject? Property, string? Error)> UpdateStatusAsync(
        string id,
        string status,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var applications = await ReadAsync(cancellationToken);
            var application = applications.FirstOrDefault(item =>
                string.Equals(item["id"]?.GetValue<string>(), id, StringComparison.Ordinal));
            if (application is null)
            {
                return (null, null, null);
            }

            var currentStatus = application["status"]?.GetValue<string>();
            if (currentStatus == status)
            {
                return ((JsonObject)application.DeepClone(), null, null);
            }

            if (currentStatus != "Pending")
            {
                return (null, null, "Only pending applications can be updated.");
            }

            JsonObject? updatedProperty = null;
            if (status == "Approved")
            {
                updatedProperty = await _propertyStore.ChangeAvailableSlotsAsync(
                    application["propertyId"]!.GetValue<string>(), -1, cancellationToken);
                if (updatedProperty is null)
                {
                    return (null, null, "No available slots remain for this listing.");
                }
            }

            application["status"] = status;
            await WriteAsync(applications, cancellationToken);
            return ((JsonObject)application.DeepClone(), updatedProperty, null);
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

    private async Task WriteAsync(List<JsonObject> applications, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(applications, JsonOptions);
        await File.WriteAllTextAsync(temporaryPath, json, cancellationToken);
        File.Move(temporaryPath, _filePath, overwrite: true);
    }
}
