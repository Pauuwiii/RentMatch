using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace RentMatch.Controllers;

[ApiController]
[Route("api/accounts")]
public sealed class AccountsController(AccountStore accountStore) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await accountStore.GetAllAsync(cancellationToken));
    }

    [HttpPost("seed")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Seed(
        [FromBody] List<JsonObject> accounts,
        CancellationToken cancellationToken)
    {
        return Ok(await accountStore.SeedIfEmptyAsync(accounts, cancellationToken));
    }

    [HttpPut("{email}")]
    public async Task<IActionResult> UpdateStatus(
        string email,
        [FromBody] JsonObject update,
        CancellationToken cancellationToken)
    {
        if (update["email"] is not JsonValue emailValue
            || !emailValue.TryGetValue<string>(out var accountEmail)
            || !string.Equals(accountEmail, email, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "The account email in the URL must match the request body." });
        }

        if (update["status"] is not JsonValue statusValue
            || !statusValue.TryGetValue<string>(out var status)
            || status is not ("In review" or "Verified" or "Active"))
        {
            return BadRequest(new { message = "The account status is invalid." });
        }

        var account = await accountStore.UpdateStatusAsync(email, status, cancellationToken);
        return account is null ? NotFound() : Ok(account);
    }

    [HttpPost]
    public async Task<IActionResult> Save(
        [FromBody] JsonObject account,
        CancellationToken cancellationToken)
    {
        if (account["email"] is not JsonValue emailValue
            || !emailValue.TryGetValue<string>(out var email)
            || string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { message = "An account email is required." });
        }

        if (account["name"] is not JsonValue nameValue
            || !nameValue.TryGetValue<string>(out var name)
            || string.IsNullOrWhiteSpace(name))
        {
            account["name"] = email.Split('@')[0];
        }

        if (account["role"] is not JsonValue roleValue
            || !roleValue.TryGetValue<string>(out var role)
            || string.IsNullOrWhiteSpace(role))
        {
            account["role"] = "Property host";
        }

        if (account["status"] is not JsonValue statusValue
            || !statusValue.TryGetValue<string>(out var status)
            || string.IsNullOrWhiteSpace(status))
        {
            account["status"] = "Verified";
        }

        var saved = await accountStore.SaveAsync(account, cancellationToken);
        return Ok(saved);
    }
}
