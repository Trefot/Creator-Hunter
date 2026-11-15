$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.Encoding]::UTF8
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
function Emit($d){[Console]::WriteLine(($d|ConvertTo-Json -Compress));[Console]::Out.Flush()}
$engine=$null
try {
 Add-Type -AssemblyName System.Speech
 $d=[Console]::In.ReadToEnd()|ConvertFrom-Json
 Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Threading;
public static class NexusMomentParent {
 public static void Watch(int id) {
  var t = new Thread(() => {
   while (true) {
    try { using (var p = Process.GetProcessById(id)) { if (p.HasExited) Environment.Exit(0); } }
    catch { Environment.Exit(0); }
    Thread.Sleep(500);
   }
  });
  t.IsBackground = true;
  t.Start();
 }
}
'@
 [NexusMomentParent]::Watch([int]$d.parent)
 $recognizer=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()|Where-Object {$_.Culture.Name -eq [string]$d.culture}|Select-Object -First 1
 if($null -eq $recognizer){throw 'No hay un reconocedor local compatible con ese idioma. Consulta los idiomas instalados y configura Reconocimiento de voz de Windows.'}
 $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $recognizer
 $choices=New-Object System.Speech.Recognition.Choices
 $choices.Add([string]$d.phrase)
 $builder=New-Object System.Speech.Recognition.GrammarBuilder
 $builder.Culture=$recognizer.Culture
 $builder.Append($choices)
 $grammar=New-Object System.Speech.Recognition.Grammar -ArgumentList $builder
 $engine.LoadGrammar($grammar)
 $engine.SetInputToDefaultAudioDevice()
 Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier NexusMoment | Out-Null
 $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
 Emit @{event='ready'}
 while($true){
  try{$null=[Diagnostics.Process]::GetProcessById([int]$d.parent)}catch{break}
  $event=Wait-Event -SourceIdentifier NexusMoment -Timeout 1
  if($null -ne $event){
   $r=$event.SourceEventArgs.Result
   Emit @{event='recognized';text=[string]$r.Text;confidence=[double]$r.Confidence}
   Remove-Event -EventIdentifier $event.EventIdentifier
  }
 }
}catch{Emit @{event='error';message=$_.Exception.Message};exit 1}
finally{
 Unregister-Event -SourceIdentifier NexusMoment -ErrorAction SilentlyContinue
 if($null -ne $engine){$engine.RecognizeAsyncCancel();$engine.Dispose()}
}
