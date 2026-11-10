using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace RentMatch.Controllers;

[ApiController]
[Route("api/applications")]
public sealed class ApplicationsController(ApplicationStore applicationStore) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await applicationStore.GetAllAsync(cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] JsonObject application,
        CancellationToken cancellationToken)
    {
        var (savedApplication, error) = await applicationStore.CreateAsync(application, cancellationToken);
        if (error is not null)
        {
            return Conflict(new { message = error });
        }

        return Created($"/api/applications/{savedApplication!["id"]}", savedApplication);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(
        string id,
        [FromBody] JsonObject update,
        CancellationToken cancellationToken)
    {
        if (update["status"] is not JsonValue statusValue
            || !statusValue.TryGetValue<string>(out var status)
            || status is not ("Approved" or "Declined"))
        {
            return BadRequest(new { message = "Status must be Approved or Declined." });
        }

        var (application, property, error) = await applicationStore.UpdateStatusAsync(
            id, status, cancellationToken);
        if (error is not null)
        {
            return Conflict(new { message = error });
        }

        return application is null ? NotFound() : Ok(new { application, property });
    }
}
