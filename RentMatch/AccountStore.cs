using System.Text.Json;
using System.Text.Json.Nodes;

namespace RentMatch;

public sealed class AccountStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath;

    public AccountStore(IWebHostEnvironment environment)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dataDirectory);
        _filePath = Path.Combine(dataDirectory, "accounts.json");
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

    public async Task<IReadOnlyList<JsonObject>> SeedIfEmptyAsync(
        IReadOnlyList<JsonObject> seedAccounts,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var accounts = await ReadAsync(cancellationToken);
            if (accounts.Count == 0 && seedAccounts.Count > 0)
            {
                accounts = seedAccounts.Select(account => (JsonObject)account.DeepClone()).ToList();
                await WriteAsync(accounts, cancellationToken);
            }

            return accounts;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<JsonObject?> UpdateStatusAsync(
        string email,
        string status,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var accounts = await ReadAsync(cancellationToken);
            var account = accounts.FirstOrDefault(item => string.Equals(
                item["email"]?.GetValue<string>(), email, StringComparison.OrdinalIgnoreCase));
            if (account is null)
            {
                return null;
            }

            account["status"] = status;
            await WriteAsync(accounts, cancellationToken);
            return (JsonObject)account.DeepClone();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<JsonObject> SaveAsync(JsonObject account, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var accounts = await ReadAsync(cancellationToken);
            var email = account["email"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(email))
            {
                throw new InvalidOperationException("Account email is required.");
            }

            var index = accounts.FindIndex(item => string.Equals(
                item["email"]?.GetValue<string>(), email, StringComparison.OrdinalIgnoreCase));

            var saved = (JsonObject)account.DeepClone();
            if (index >= 0)
            {
                foreach (var (key, value) in saved)
                {
                    accounts[index][key] = value?.DeepClone();
                }
                saved = (JsonObject)accounts[index].DeepClone();
            }
            else
            {
                accounts.Add(saved);
            }

            await WriteAsync(accounts, cancellationToken);
            return saved;
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

    private async Task WriteAsync(List<JsonObject> accounts, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(accounts, JsonOptions);
        await File.WriteAllTextAsync(temporaryPath, json, cancellationToken);
        File.Move(temporaryPath, _filePath, overwrite: true);
    }
}
