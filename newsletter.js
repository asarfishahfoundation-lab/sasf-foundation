document.querySelectorAll(".subscribe-form").forEach(form => {
    const emailInput = form.querySelector('input[type="email"]');
    const message = form.parentElement.querySelector(".subscribe-message");
    const button = form.querySelector('button[type="submit"]');

    if (!emailInput || !button || !message) {
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            message.textContent = "Please enter your email address.";
            return;
        }

        message.textContent = "Subscribing…";
        button.disabled = true;

        try {
            const response = await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                message.textContent = data.message || "Thank you for subscribing!";
                form.reset();
            } else {
                message.textContent = data.message || data.error || "Unable to subscribe.";
            }
        } catch (error) {
            console.error("Subscription error:", error);
            message.textContent = "Unable to connect to the server.";
        } finally {
            button.disabled = false;
        }
    });
});
