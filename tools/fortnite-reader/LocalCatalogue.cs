// The research harness never contacts the catalogue service. Unknown prize IDs stay as IDs.
namespace ChestCounter;
public sealed record LocalPrize(string Name,string Kind);
public static class TreasureCatalog {
 public const string PirateShop="pirate_shop";
 public static LocalPrize? Find(string id)=>null;
 public static string KindName(string kind)=>kind;
}
