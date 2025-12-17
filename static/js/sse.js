const evt = new EventSource("/events");
evt.onmessage = e => {
    console.log("LIVE UPDATE:", JSON.parse(e.data));
    location.reload();
};
