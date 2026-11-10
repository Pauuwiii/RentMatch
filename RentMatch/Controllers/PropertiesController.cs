using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace RentMatch.Controllers;

[ApiController]
[Route("api/properties")]
public sealed class PropertiesController(PropertyStore propertyStore) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await propertyStore.GetAllAsync(cancellationToken));
    }

    [HttpPost("seed")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Seed(
        [FromBody] List<JsonObject> properties,
        CancellationToken cancellationToken)
    {
        return Ok(await propertyStore.MergeSeedPropertiesAsync(properties, cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject>> GetById(string id, CancellationToken cancellationToken)
    {
        var property = await propertyStore.GetByIdAsync(id, cancellationToken);
        return property is null ? NotFound() : Ok(property);
    }

    [HttpPost("{id}/slots/open")]
    public async Task<IActionResult> OpenSlot(string id, CancellationToken cancellationToken)
    {
        var property = await propertyStore.ChangeAvailableSlotsAsync(id, 1, cancellationToken);
        if (property is null)
        {
            return Conflict(new { message = "The listing is missing or already has all slots available." });
        }

        return Ok(property);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Save(
        string id,
        [FromBody] JsonObject property,
        CancellationToken cancellationToken)
    {
        if (property["id"] is not JsonValue idValue
            || !idValue.TryGetValue<string>(out var propertyId)
            || !string.Equals(propertyId, id, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "The property ID in the URL must match the request body." });
        }

        if (property["name"] is not JsonValue nameValue
            || !nameValue.TryGetValue<string>(out var name)
            || string.IsNullOrWhiteSpace(name)
            || property["address"] is not JsonValue addressValue
            || !addressValue.TryGetValue<string>(out var address)
            || string.IsNullOrWhiteSpace(address))
        {
            return BadRequest(new { message = "A property name and address are required." });
        }

        if (property["price"] is not JsonValue priceValue
            || !priceValue.TryGetValue<decimal>(out var price)
            || price <= 0)
        {
            return BadRequest(new { message = "The property price must be greater than zero." });
        }

        var savedProperty = await propertyStore.SaveAsync(property, cancellationToken);
        return Ok(savedProperty);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        return await propertyStore.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
    }
}
