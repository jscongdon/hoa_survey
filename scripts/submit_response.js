(async () => {
  try {
    const token =
      "727e1b13bb6fcbee8af13bde57706155d9cd79d625c0a1c35deb77a8d41234ee";
    const res = await fetch(`http://localhost:3000/api/responses/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log("Status:", res.status, "Body:", text);
  } catch (e) {
    console.error("Error:", e);
    process.exitCode = 1;
  }
})();
