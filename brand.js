(() => {
    const fallback = {
        foundation_name: "Shree Asarfi Shah Foundation",
        foundation_short_name: "SASF"
    };

    let names = { ...fallback };
    let previousNames = null;

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function updateBranding(value) {
        if (typeof value !== "string" || !value.trim()) return value;
        let updated = value
            .replace(/\b(?:SHREE\s+)?ASARFI\s+SHAH\s+FOUNDATION\b/gi, names.foundation_name)
            .replace(/\b(?:ASF|SASF)\b/gi, names.foundation_short_name);
        if (previousNames) {
            if (previousNames.foundation_name) {
                updated = updated.replace(
                    new RegExp(escapeRegExp(previousNames.foundation_name), "gi"),
                    names.foundation_name
                );
            }
            if (previousNames.foundation_short_name) {
                updated = updated.replace(
                    new RegExp(`\\b${escapeRegExp(previousNames.foundation_short_name)}\\b`, "gi"),
                    names.foundation_short_name
                );
            }
        }
        return updated;
    }

    function updateTree(root) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement && !node.parentElement.closest("script,style,noscript")) {
                textNodes.push(node);
            }
        }
        textNodes.forEach(node => {
            const updated = updateBranding(node.nodeValue);
            if (updated !== node.nodeValue) node.nodeValue = updated;
        });

        if (root.nodeType === Node.ELEMENT_NODE) {
            ["title", "aria-label", "alt", "content"].forEach(attribute => {
                if (!root.hasAttribute(attribute)) return;
                const oldValue = root.getAttribute(attribute);
                const newValue = updateBranding(oldValue);
                if (newValue !== oldValue) root.setAttribute(attribute, newValue);
            });
        }
    }

    function applyBranding() {
        updateTree(document.body);
        updateTree(document.head);
        if (document.title) document.title = updateBranding(document.title);
    }

    let foundationSiteContentPromise;
    window.getFoundationSiteContent = () => {
        if (!foundationSiteContentPromise) {
            foundationSiteContentPromise = fetch("/api/site-content")
                .then(response => response.ok ? response.json() : null)
                .then(data => data && data.content ? data.content : null)
                .catch(() => null);
        }
        return foundationSiteContentPromise;
    };

    window.applyFoundationBranding = (content = {}) => {
        previousNames = { ...names };
        names.foundation_name = content.foundation_name || names.foundation_name;
        names.foundation_short_name = content.foundation_short_name || names.foundation_short_name;
        applyBranding();
        previousNames = null;
    };

    document.addEventListener("website:content-saved", event => {
        const { key, value } = event.detail || {};
        previousNames = { ...names };
        if (key === "foundation_name") names.foundation_name = value;
        if (key === "foundation_short_name") names.foundation_short_name = value;
        applyBranding();
        previousNames = null;
    });

    const observer = new MutationObserver(records => {
        records.forEach(record => {
            if (record.type === "characterData") {
                const updated = updateBranding(record.target.nodeValue);
                if (updated !== record.target.nodeValue) record.target.nodeValue = updated;
            } else {
                record.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const updated = updateBranding(node.nodeValue);
                        if (updated !== node.nodeValue) node.nodeValue = updated;
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        updateTree(node);
                    }
                });
            }
        });
    });

    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true
    });

    applyBranding();
    window.getFoundationSiteContent().then(content => {
        if (content) window.applyFoundationBranding(content);
    });
})();
