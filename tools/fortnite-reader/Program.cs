using ChestCounter;
using System.Text.Json;
using System.Security.Cryptography;
// No GUI, updater, catalogue downloads, login or network clients are compiled into this helper.
if(args.Length!=1){Console.Error.WriteLine("Indica una repetición de Fortnite.");return 1;}
foreach(var name in new[]{"CHESTCOUNTER_DEBUG","CHESTCOUNTER_MODE","CHESTCOUNTER_PROBE","CHESTCOUNTER_PROBE_GUIDS","CHESTCOUNTER_PROBE_HEX"})Environment.SetEnvironmentVariable(name,null);
L.Set("es");
try{
 using var input=new FileStream(args[0],FileMode.Open,FileAccess.Read,FileShare.ReadWrite);
 if(input.Length>256*1024*1024||input.Length<64)throw new Exception("Tamaño de repetición no admitido.");
 using(var br=new BinaryReader(input,System.Text.Encoding.UTF8,true)){
  if(br.ReadUInt32()!=0x1CA2E27F)throw new Exception("No es una repetición de Fortnite.");
  var ver=br.ReadUInt32();if(ver>=7){var count=br.ReadInt32();if(count<0||count>64)throw new Exception("Cabecera no compatible.");input.Seek(count*20L,SeekOrigin.Current);}
  input.Seek(12,SeekOrigin.Current);var len=br.ReadInt32();if(Math.Abs((long)len)>4096)throw new Exception("Cabecera no compatible.");input.Seek(len<0?-2L*len:len,SeekOrigin.Current);
  var live=br.ReadUInt32()!=0;br.ReadInt64();br.ReadUInt32();var encrypted=br.ReadUInt32()!=0;
  if(live)return 2;
  if(encrypted){var n=br.ReadInt32();if(n<=0||n>256||br.ReadBytes(n).All(b=>b==0))return 2;}
 }
 input.Position=0;var analyzer=new ReplayAnalyzer();var r=analyzer.Analyze(input,args[0],null);
 if(analyzer.IsPartialReplay)throw new Exception("La repetición está incompleta. No se ha sumado nada.");
 bool Id(string? id)=>id is {Length:32}&&id.All(Uri.IsHexDigit);
 if(!r.IsReplayOwner||!Id(r.EpicId)||!Id(r.SessionId)||r.MatchStartUtc==null||r.DurationSeconds==null)throw new Exception("No se pudo identificar de forma fiable al jugador o la partida.");
 var start=new DateTimeOffset(DateTime.SpecifyKind(r.MatchStartUtc.Value,DateTimeKind.Utc)).ToUnixTimeMilliseconds();
 var opened=r.Chests.Count(c=>!c.Destroyed&&!c.AttributionInferred);var destroyed=r.Chests.Count(c=>c.Destroyed&&!c.AttributionInferred);var uncertain=r.Chests.Count(c=>c.AttributionInferred);
 Console.WriteLine(JsonSerializer.Serialize(new{schema=1,match_id=r.SessionId.ToLowerInvariant(),account_id=r.EpicId!.ToLowerInvariant(),player=r.PlayerName,started_ms=start,ended_ms=start+r.DurationSeconds.Value*1000L,opened,destroyed,uncertain,vehicle_missing=r.VehicleChestsMissing,reader_version=ReplayAnalyzer.CurrentVersion,game_version=r.GameVersion}));return 0;
}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
