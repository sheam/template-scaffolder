using Microsoft.AspNetCore.Mvc;

namespace Brew.Api.Tanks;

/// <summary>Kinds of tank.</summary>
public enum TankType : byte
{
    Fermenter = 1,
    BrightTank,
}

public record TankDto(int TankId, string? Name = null);

public class UpdateTankRequest
{
    public int TankId { get; set; }
    public string Name { get; init; } = "";
    public List<int>? IngredientIds { get; set; }
    public int Version { get; }
    private readonly ILogger _logger;
    public const int MaxNameLength = 50;
}

/// <summary>Tanks endpoints.</summary>
[ApiController]
[Route("api/tanks")]
public partial class TanksController : ControllerBase, ITanksController
{
    [HttpGet]
    public async Task<ActionResult<List<TankDto>>> GetTanks(int pageSize, [FromQuery] int? pageNumber = null)
    {
        return Ok();
    }

    [HttpDelete("{tankId}")]
    public Task DeleteTank(int tankId) => Task.CompletedTask;

    private static int Helper() => 1;
}

namespace Nested
{
    public interface ITanksController<T> where T : class
    {
        Task<T> Get(int id);
        string Name { get; }
    }

    public struct Point { public int X; public int Y; }
}
