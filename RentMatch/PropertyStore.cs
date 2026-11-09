using System.Text.Json;
using System.Text.Json.Nodes;

namespace RentMatch;

public sealed class PropertyStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath;

    public PropertyStore(IWebHostEnvironment environment)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dataDirectory);
        _filePath = Path.Combine(dataDirectory, "properties.json");
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

    public async Task<JsonObject?> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var properties = await ReadAsync(cancellationToken);
            return properties.FirstOrDefault(property => string.Equals(
                property["id"]?.GetValue<string>(), id, StringComparison.Ordinal));
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<JsonObject?> ChangeAvailableSlotsAsync(
        string id,
        int change,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var properties = await ReadAsync(cancellationToken);
            var property = properties.FirstOrDefault(item => string.Equals(
                item["id"]?.GetValue<string>(), id, StringComparison.Ordinal));
            if (property is null)
            {
                return null;
            }

            var availableSlots = property["units"]?.GetValue<int>() ?? 0;
            var totalSlots = property["totalUnits"]?.GetValue<int>() ?? availableSlots;
            var updatedSlots = availableSlots + change;
            if (updatedSlots < 0 || updatedSlots > totalSlots)
            {
                return null;
            }

            property["units"] = updatedSlots;
            property["available"] = updatedSlots > 0;
            await WriteAsync(properties, cancellationToken);
            return (JsonObject)property.DeepClone();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<JsonObject>> MergeSeedPropertiesAsync(
        IReadOnlyList<JsonObject> seedProperties,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var properties = await ReadAsync(cancellationToken);
            var changed = false;
            foreach (var seedProperty in seedProperties)
            {
                var seedId = seedProperty["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(seedId))
                {
                    continue;
                }

                var existing = properties.FirstOrDefault(property =>
                    string.Equals(property["id"]?.GetValue<string>(), seedId, StringComparison.Ordinal)
                    || string.Equals(property["sourceListingId"]?.GetValue<string>(), seedId, StringComparison.Ordinal));
                if (existing is null && seedProperty["sourceDocumentListing"]?.GetValue<bool>() == true)
                {
                    var seedName = seedProperty["name"]?.GetValue<string>();
                    existing = properties.FirstOrDefault(property =>
                        string.Equals(property["name"]?.GetValue<string>(), seedName, StringComparison.OrdinalIgnoreCase));
                }

                if (existing is not null)
                {
                    if (seedProperty["sourceDocumentListing"]?.GetValue<bool>() == true)
                    {
                        foreach (var key in new[] { "host", "hostEmail", "ownerEmail", "isMine" })
                        {
                            var seedValue = seedProperty[key];
                            if (seedValue is not null
                                && existing[key]?.ToJsonString() != seedValue.ToJsonString())
                            {
                                existing[key] = seedValue.DeepClone();
                                changed = true;
                            }
                        }
                    }

                    if (string.Equals(existing["sourceListingId"]?.GetValue<string>(), seedId, StringComparison.Ordinal)
                        || string.Equals(existing["id"]?.GetValue<string>(), seedId, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    var existingId = existing["id"]?.DeepClone();
                    var coverImage = existing["image"]?.DeepClone() ?? seedProperty["image"]?.DeepClone();
                    var images = new List<string>();
                    foreach (var source in new[] { existing["images"], seedProperty["images"] })
                    {
                        if (source is JsonArray imageArray)
                        {
                            images.AddRange(imageArray
                                .OfType<JsonValue>()
                                .Select(image => image.GetValue<string>())
                                .Where(image => !string.IsNullOrWhiteSpace(image)));
                        }
                    }

                    foreach (var image in new[] { existing["image"], seedProperty["image"] })
                    {
                        if (image is JsonValue imageValue && imageValue.TryGetValue<string>(out var imageUrl))
                        {
                            images.Add(imageUrl);
                        }
                    }

                    foreach (var (key, value) in seedProperty)
                    {
                        if (key is "id" or "image" or "images" or "host" or "hostEmail" or "ownerEmail"
                            or "available" or "isDraft" or "units" or "totalUnits")
                        {
                            continue;
                        }

                        existing[key] = value?.DeepClone();
                    }

                    existing["id"] = existingId;
                    existing["sourceListingId"] = seedId;
                    existing["image"] = coverImage;
                    existing["images"] = new JsonArray(images.Distinct(StringComparer.Ordinal)
                        .Select(image => (JsonNode?)JsonValue.Create(image))
                        .ToArray());
                    changed = true;
                    continue;
                }

                var newProperty = (JsonObject)seedProperty.DeepClone();
                newProperty["sourceListingId"] = seedId;
                properties.Insert(0, newProperty);
                changed = true;
            }

            if (changed)
            {
                await WriteAsync(properties, cancellationToken);
            }

            return properties;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<JsonObject> SaveAsync(JsonObject property, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var properties = await ReadAsync(cancellationToken);
            var id = property["id"]!.GetValue<string>();
            var index = properties.FindIndex(item => string.Equals(
                item["id"]?.GetValue<string>(), id, StringComparison.Ordinal));
            var savedProperty = (JsonObject)property.DeepClone();

            if (index >= 0)
            {
                properties[index] = savedProperty;
            }
            else
            {
                properties.Insert(0, savedProperty);
            }

            await WriteAsync(properties, cancellationToken);
            return savedProperty;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var properties = await ReadAsync(cancellationToken);
            var removed = properties.RemoveAll(property => string.Equals(
                property["id"]?.GetValue<string>(), id, StringComparison.Ordinal));
            if (removed == 0)
            {
                return false;
            }

            await WriteAsync(properties, cancellationToken);
            return true;
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
        var properties = JsonSerializer.Deserialize<List<JsonObject>>(json) ?? [];
        var migrated = false;
        foreach (var property in properties)
        {
            if (property["units"] is not JsonValue unitsValue
                || !unitsValue.TryGetValue<int>(out var units))
            {
                units = property["available"]?.GetValue<bool>() == false ? 0 : 1;
                property["units"] = units;
                migrated = true;
            }

            if (property["totalUnits"] is not JsonValue totalValue
                || !totalValue.TryGetValue<int>(out _))
            {
                property["totalUnits"] = Math.Max(units, 1);
                migrated = true;
            }

            if (property["available"]?.GetValue<bool>() != (units > 0))
            {
                property["available"] = units > 0;
                migrated = true;
            }
        }

        if (migrated)
        {
            await WriteAsync(properties, cancellationToken);
        }

        return properties;
    }

    private async Task WriteAsync(List<JsonObject> properties, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(properties, JsonOptions);
        await File.WriteAllTextAsync(temporaryPath, json, cancellationToken);
        File.Move(temporaryPath, _filePath, overwrite: true);
    }
}
