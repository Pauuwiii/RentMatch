using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace RentMatch.Controllers;

[ApiController]
[Route("api/maintenance-requests")]
public sealed class MaintenanceRequestsController(MaintenanceRequestStore requestStore) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await requestStore.GetAllAsync(cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] JsonObject request,
        CancellationToken cancellationToken)
    {
        var (savedRequest, error) = await requestStore.CreateAsync(request, cancellationToken);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        return Created($"/api/maintenance-requests/{savedRequest!["id"]}", savedRequest);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(
        string id,
        [FromBody] JsonObject update,
        CancellationToken cancellationToken)
    {
        if (update["status"] is not JsonValue statusValue
            || !statusValue.TryGetValue<string>(out var status)
            || status is not ("Received" or "In progress" or "Completed"))
        {
            return BadRequest(new { message = "Status must be Received, In progress, or Completed." });
        }

        var request = await requestStore.UpdateStatusAsync(id, status, cancellationToken);
        return request is null ? NotFound() : Ok(request);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(
        string id,
        [FromQuery] string renterEmail,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(renterEmail))
        {
            return BadRequest(new { message = "Renter email is required to remove a request." });
        }

        var (found, deleted) = await requestStore.DeleteAsync(id, renterEmail, cancellationToken);
        if (!found)
        {
            return NotFound();
        }

        return deleted ? NoContent() : StatusCode(StatusCodes.Status403Forbidden);
    }
}
