document.addEventListener('paste', async (event) => {
    const clipboardData = event.clipboardData || window.clipboardData;
    const items = clipboardData.items;

    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const url = URL.createObjectURL(blob);
            const date = new Date();
            const year = String(date.getFullYear()).slice(2);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            const fileName = `${year}${month}${day}${hour}${minute}${second}.${blob.type.split('/')[1]}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (item.kind === 'string') {
            item.getAsString((text) => {
                if (text.startsWith('http://') || text.startsWith('https://')) {
                    window.open(text, '_blank');
                } else {
                    const truncatedText = text.slice(0, 12).replace(/[\s\W]/g, '_');
                    const fileName = `${truncatedText}.txt`;

                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            });
        }
    }
});
