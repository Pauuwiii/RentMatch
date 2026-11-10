using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace RentMatch.Controllers;

[ApiController]
[Route("api/viewings")]
public sealed class ViewingsController(ViewingStore viewingStore) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await viewingStore.GetAllAsync(cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] JsonObject viewing,
        CancellationToken cancellationToken)
    {
        var (savedViewing, error) = await viewingStore.CreateAsync(viewing, cancellationToken);
        if (error is not null)
        {
            return Conflict(new { message = error });
        }

        return Created($"/api/viewings/{savedViewing!["id"]}", savedViewing);
    }

    [HttpPut("{id}/response")]
    public async Task<IActionResult> UpdateResponse(
        string id,
        [FromBody] JsonObject response,
        CancellationToken cancellationToken)
    {
        if (response["status"] is not JsonValue statusValue
            || !statusValue.TryGetValue<string>(out var status)
            || status is not ("Available" or "Unavailable")
            || response["hostComment"] is not JsonValue commentValue
            || !commentValue.TryGetValue<string>(out var hostComment)
            || string.IsNullOrWhiteSpace(hostComment)
            || hostComment.Length > 1000)
        {
            return BadRequest(new { message = "A valid status and a message of 1,000 characters or fewer are required." });
        }

        var (viewing, error) = await viewingStore.UpdateResponseAsync(
            id, status, hostComment, cancellationToken);
        if (error is not null)
        {
            return Conflict(new { message = error });
        }

        return viewing is null ? NotFound() : Ok(viewing);
    }
}
