function filterLines() {
    const filterText = document.getElementById("filter").value;
    const inputText = document.getElementById("inputText").value;
    const inputLines = inputText.split('\n');
    const filteredLines = inputLines.filter(line => line.startsWith(filterText));
    const outputText = filteredLines.join('\n');
    document.getElementById("outputText").value = outputText;
}
