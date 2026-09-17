Ich will eine minimlistische App bauen (für android, iOS und web browser) die verwendet werden kann, um sich für jedes einzelne Foto eines Films das man analog aufnimmt Notitzen zu machen. So kann man sowohl verschiedene presets verwenden (für verwendete Kamera, objektiv und Filter. Belichtungszeit, etc.) und für Notizen zu Ort, Zeit und Kontext. Es soll außerdem auch auswählbar sein, welcher Film verwendet wurde. Hier soll es auch mehrere Presets geben von Filmen die zu meiner Minolta Kamera passen.

Szenario: Nutzer nimmt Foto auf, öffnet App, legt neuen Film in der App an, wählt aus Presets den Kodak 200 Gold (Farbfilm) aus, erstellt ein erstes Foto innerhalb der App, bearbeitet die Metadaten innerhalb des ersten Fotos.

@./Minolta_7000_AF_Preset.md
 Als initialen Dateninput kannst du mein eigenes Kamera Setup verwenden. Die App soll aber erweiterbar sein.

Später wenn die Fotos entwickelt von dm oder Roßmann in digitalisierter Form via API ankommen, sollen diese Fotos für Social Media Plattformen oder für einen persönlichen Wordpress Blog exportiert werden können. 

Ich will einen Arbeitsablauf etablieren, der routiniert die neu entwickelten Fotos in digitalisierter Form entsprechend zu meiner App hinzufügt und auf die vorher gesammelten Notizen.

Dieses Projekt ist etwas größer, also nimm dir entsprechend viel Zeit für die Projektplanung.
Zunächst sollst du die Anforderungen analysieren und mir deshalb ein paar Fragen zu technischen oder fachlichen Details geben, die in den Projektplan einfließen.
Der Projektplan soll aus mehreren Tickets bestehen, die einzelne Implementierungsschritte abbilden.
Dann sollst du in diesem Ordner ein neues git repo initialisieren und von jetzt an alle einzelnen Schritte semnantisch sauber commiten.
Für die Entwicklung soll ein Test-Driven-Ansatz gewählt werden.

Du kannst und sollst für die Entwicklung mehrere AI-Agents parallel laufen lassen, ohne dass sie sich groß in die Quere kommen. Jeder Agent soll sich ein Ticket nehmen und entsprechend abbarbeiten und sich dabei mit den anderen Agenten synchronisieren. Die Entwicklung soll innerhalb einer Docker Sandbox (sbx) stattfinden
