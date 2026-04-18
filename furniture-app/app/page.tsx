"use client";

import { useEffect, useRef, useState } from "react";

interface Item {
  id: string;
  name: string;
  price: string;
  description?: string;
  imageDataUrl: string;
}

interface UploadedImage {
  id: string;
  imageDataUrl: string;
  name: string;
  price: string;
  description?: string;
  loadingCaption?: boolean;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("sellout-items");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [gateCleared, setGateCleared] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sellout-gate-passed") === "true";
  });
  const [gateFirstName, setGateFirstName] = useState("");
  const [gateEmail, setGateEmail] = useState("");
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateError, setGateError] = useState("");
  const [editingItems, setEditingItems] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [view, setView] = useState<"main" | "facebook">("main");
  const [fbCondition, setFbCondition] = useState("Used - Good");
  const [fbShipping, setFbShipping] = useState("No");
  const [fbFreeShipping, setFbFreeShipping] = useState("No");
  const [fbDownloaded, setFbDownloaded] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("sellout-items", JSON.stringify(items));
    } catch { /* quota exceeded */ }
  }, [items]);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    if (!gateFirstName.trim() || !gateEmail.trim()) {
      setGateError("Please fill in both fields.");
      return;
    }
    setGateSubmitting(true);
    setGateError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: gateFirstName.trim(),
          email: gateEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to subscribe");
      localStorage.setItem("sellout-gate-passed", "true");
      setGateCleared(true);
    } catch (e) {
      setGateError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setGateSubmitting(false);
    }
  }

  async function generateCaption(imageId: string, dataUrl: string) {
    try {
      const res = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate caption");
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, name: data.name || img.name, description: data.description || img.description, loadingCaption: false }
            : img
        )
      );
    } catch {
      setUploadedImages((prev) =>
        prev.map((img) => img.id === imageId ? { ...img, loadingCaption: false } : img)
      );
    }
  }

  function handleMultipleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImages: UploadedImage[] = [];
    let loadedCount = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const id = crypto.randomUUID();
        newImages.push({ id, imageDataUrl: result, name: "", price: "", loadingCaption: true });
        loadedCount++;
        if (loadedCount === files.length) {
          setUploadedImages((prev) => [...prev, ...newImages]);
          newImages.forEach((img) => generateCaption(img.id, img.imageDataUrl));
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function updateUploadedImage(id: string, field: "name" | "price" | "description", value: string) {
    setUploadedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, [field]: value } : img))
    );
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  }

  function updateItem(id: string, field: "name" | "price" | "description", value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function confirmUploadedItems() {
    const incompleteItems = uploadedImages.filter((img) => !img.name.trim() || !img.price.trim());
    if (incompleteItems.length > 0) {
      setError(`Please fill in name and price for all ${incompleteItems.length} item(s).`);
      return;
    }
    setError("");
    const newItems = uploadedImages.map((img) => ({
      id: img.id,
      name: img.name.trim(),
      price: img.price.trim(),
      description: img.description?.trim() || undefined,
      imageDataUrl: img.imageDataUrl,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setUploadedImages([]);
  }

  async function generateDeck() {
    if (!items.length) return;
    setLoadingDeck(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 16;
      const footerH = 14;
      const footerY = pageH - footerH;

      // ── Index page ──────────────────────────────────────────
      pdf.setFillColor(247, 245, 241);
      pdf.rect(0, 0, pageW, pageH, "F");

      // Wordmark — centred, matching app header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(30);
      pdf.setTextColor(28, 25, 23);
      pdf.text("SELLOUT", pageW / 2, 46, { align: "center" });

      // Divider
      const divW = 52;
      pdf.setDrawColor(200, 195, 188);
      pdf.setLineWidth(0.4);
      pdf.line((pageW - divW) / 2, 52, (pageW + divW) / 2, 52);

      // Tagline
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(160, 150, 140);
      pdf.text("snap it. list it. your move.", pageW / 2, 59, { align: "center" });

      // Column headers
      let rowY = 78;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(160, 150, 140);
      pdf.text("#", margin, rowY);
      pdf.text("ITEM", margin + 12, rowY);
      pdf.text("PRICE", pageW - margin, rowY, { align: "right" });
      rowY += 3;
      pdf.setDrawColor(220, 215, 208);
      pdf.setLineWidth(0.25);
      pdf.line(margin, rowY, pageW - margin, rowY);
      rowY += 8;

      items.forEach((item, idx) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(180, 170, 160);
        pdf.text(`${idx + 1}`, margin, rowY);

        // Name with charcoal underline (not blue — matches app palette)
        pdf.setTextColor(28, 25, 23);
        pdf.text(item.name, margin + 12, rowY);
        const nameWidth = pdf.getTextWidth(item.name);
        pdf.setDrawColor(28, 25, 23);
        pdf.setLineWidth(0.25);
        pdf.line(margin + 12, rowY + 1, margin + 12 + nameWidth, rowY + 1);

        pdf.setFont("helvetica", "bold");
        pdf.text(`$${item.price}`, pageW - margin, rowY, { align: "right" });

        pdf.link(margin - 2, rowY - 5, pageW - margin * 2 + 4, 10, { pageNumber: idx + 2 });

        // Row divider
        pdf.setDrawColor(235, 232, 228);
        pdf.setLineWidth(0.2);
        pdf.line(margin, rowY + 4, pageW - margin, rowY + 4);
        rowY += 12;
      });

      // Index footer
      pdf.setFillColor(237, 234, 229);
      pdf.rect(0, pageH - footerH, pageW, footerH, "F");
      pdf.setTextColor(160, 150, 140);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${items.length} item${items.length !== 1 ? "s" : ""}`, margin, pageH - 5);

      // ── Item pages ──────────────────────────────────────────
      for (let i = 0; i < items.length; i++) {
        pdf.addPage();
        const item = items[i];

        // Warm off-white background
        pdf.setFillColor(247, 245, 241);
        pdf.rect(0, 0, pageW, pageH, "F");

        // Charcoal header bar — name + price stacked
        const itemHeaderH = 30;
        pdf.setFillColor(28, 25, 23);
        pdf.rect(0, 0, pageW, itemHeaderH, "F");

        pdf.setTextColor(247, 245, 241);
        pdf.setFontSize(15);
        pdf.setFont("helvetica", "bold");
        pdf.text(item.name, margin, 13);

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(180, 170, 160);
        pdf.text(`$${item.price}`, margin, 23);

        // Image
        const imgStartY = itemHeaderH + 5;
        const descReserve = item.description ? 36 : 0;
        const imgMaxH = footerY - imgStartY - descReserve - 4;
        let imgBottomY = imgStartY;

        try {
          const imgProps = pdf.getImageProperties(item.imageDataUrl);
          const aspect = imgProps.width / imgProps.height;
          const availW = pageW - margin * 2;
          let imgW = availW;
          let imgH = imgW / aspect;
          if (imgH > imgMaxH) { imgH = imgMaxH; imgW = imgH * aspect; }
          const imgX = (pageW - imgW) / 2;
          pdf.addImage(item.imageDataUrl, "JPEG", imgX, imgStartY, imgW, imgH);
          imgBottomY = imgStartY + imgH;
        } catch {
          pdf.setTextColor(180, 170, 160);
          pdf.setFontSize(12);
          pdf.text("Image unavailable", pageW / 2, pageH / 2, { align: "center" });
        }

        // Description with thin separator line above
        if (item.description) {
          pdf.setDrawColor(220, 215, 208);
          pdf.setLineWidth(0.25);
          pdf.line(margin, imgBottomY + 4, pageW - margin, imgBottomY + 4);
          pdf.setTextColor(80, 73, 69);
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "normal");
          const lines = pdf.splitTextToSize(item.description, pageW - margin * 2);
          pdf.text(lines, margin, imgBottomY + 11);
        }

        // Footer
        pdf.setFillColor(237, 234, 229);
        pdf.rect(0, pageH - footerH, pageW, footerH, "F");
        pdf.setTextColor(160, 150, 140);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${i + 1} / ${items.length}`, pageW / 2, pageH - 5, { align: "center" });
      }

      pdf.save("sellout-listings.pdf");
    } finally {
      setLoadingDeck(false);
    }
  }

  async function downloadFacebookTemplate() {
    const XLSX = await import("xlsx");
    const rows = [
      ["Facebook Marketplace Bulk Upload Template","","","","","","","",""],
      ["You can create up to 50 listings at once. When you are finished, be sure to save or export this as an XLS/XLSX file.","","","","","","","",""],
      [
        "REQUIRED | Plain text (up to 150 characters",
        "REQUIRED | A whole number in $",
        "REQUIRED | Supported values: \"New\"; \"Used - Like New\"; \"Used - Good\"; \"Used - Fair\"",
        "OPTIONAL | Plain text (up to 5000 characters)",
        "OPTIONAL | Type of listing",
        "OPTIONAL | Enter a number in pounds if you will use a prepaid shipping label from Facebook. Use a period (\".\") as the decimal point.",
        "OPTIONAL | Supported values: \"Yes\" or \"No\". Set to \"Yes\" to absorb shipping cost for buyer.",
        "OPTIONAL | Supported values: \"Yes\" or \"No\". Set to \"Yes\" to offer shipping.",
        ""
      ],
      ["TITLE","PRICE","CONDITION","DESCRIPTION","CATEGORY","SHIPPING WEIGHT","OFFER FREE SHIPPING","OFFER SHIPPING",""],
      ...items.map((item) => [
        item.name,
        parseInt(item.price) || 0,
        fbCondition,
        item.description || "",
        "Home & Garden//Furniture",
        "",
        fbShipping === "Yes" ? fbFreeShipping : "No",
        fbShipping,
        ""
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Upload Template");
    XLSX.writeFile(wb, "facebook-marketplace-upload.xlsx");
    setFbDownloaded(true);
  }

  if (!gateCleared) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-14 min-h-screen flex flex-col">
        <header className="mb-14 text-center">
          <h1 className="font-[family-name:var(--font-playfair)] text-5xl font-bold tracking-[0.25em] text-stone-900 uppercase">Sellout</h1>
          <hr className="border-stone-300 mt-3 mb-2.5 mx-auto w-56" />
          <p className="text-xs text-stone-400 tracking-[0.18em] font-light">snap it. list it. your move.</p>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <p className="text-sm text-stone-500 font-light mb-8 text-center leading-relaxed">
            Enter your details to get started.
          </p>
          <form onSubmit={submitGate} className="space-y-3">
            <input
              type="text"
              placeholder="First name"
              value={gateFirstName}
              onChange={(e) => setGateFirstName(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
            />
            <input
              type="email"
              placeholder="Email address"
              value={gateEmail}
              onChange={(e) => setGateEmail(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
            />
            {gateError && <p className="text-red-400 text-xs">{gateError}</p>}
            <button
              type="submit"
              disabled={gateSubmitting}
              className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-medium rounded-lg py-3 text-sm transition"
            >
              {gateSubmitting ? "Just a moment…" : "Get started"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-14">

      {/* Wordmark */}
      <header className="mb-14 text-center">
        <h1 className="font-[family-name:var(--font-playfair)] text-5xl font-bold tracking-[0.25em] text-stone-900 uppercase">Sellout</h1>
        <hr className="border-stone-300 mt-3 mb-2.5 mx-auto w-56" />
        <p className="text-xs text-stone-400 tracking-[0.18em] font-light">snap it. list it. your move.</p>
      </header>

      {/* Facebook Marketplace view */}
      {view === "facebook" && (
        <section>
          {!fbDownloaded ? (
            <>
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setView("main")} className="text-stone-400 hover:text-stone-700 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base font-medium text-stone-900">Facebook Marketplace upload</h2>
              </div>

              {/* Item list preview */}
              <div className="bg-white rounded-xl border border-stone-100 mb-6 divide-y divide-stone-50">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-stone-700">{item.name}</span>
                    <span className="text-sm font-medium text-stone-900">${item.price}</span>
                  </div>
                ))}
              </div>

              {/* Shared settings */}
              <div className="bg-white rounded-xl border border-stone-100 p-5 mb-6 space-y-5">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Shared settings</p>

                <div>
                  <label className="block text-sm text-stone-700 mb-2">Condition</label>
                  <select
                    value={fbCondition}
                    onChange={(e) => setFbCondition(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
                  >
                    <option>New</option>
                    <option>Used - Like New</option>
                    <option>Used - Good</option>
                    <option>Used - Fair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2">Offer shipping?</label>
                  <div className="flex gap-2">
                    {["Yes", "No"].map((v) => (
                      <button
                        key={v}
                        onClick={() => { setFbShipping(v); if (v === "No") setFbFreeShipping("No"); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${fbShipping === v ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {fbShipping === "Yes" && (
                  <div>
                    <label className="block text-sm text-stone-700 mb-2">Offer free shipping?</label>
                    <div className="flex gap-2">
                      {["Yes", "No"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setFbFreeShipping(v)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${fbFreeShipping === v ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={downloadFacebookTemplate}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl py-3 text-sm transition"
              >
                Download upload template
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => { setView("main"); setFbDownloaded(false); }} className="text-stone-400 hover:text-stone-700 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base font-medium text-stone-900">Template downloaded</h2>
              </div>

              <div className="bg-white rounded-xl border border-stone-100 p-6 mb-4">
                <p className="text-sm font-medium text-stone-900 mb-5">How to upload to Facebook Marketplace</p>
                <ol className="space-y-4">
                  {[
                    "Open Facebook and go to Marketplace.",
                    "Click \"Create new listing\" and select \"Item for sale\".",
                    "At the bottom of the form, click \"Upload a file\" instead of adding manually.",
                    "Select the file you just downloaded: facebook-marketplace-upload.xlsx",
                    "Facebook will preview each listing — review them and click \"Publish all\".",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 text-stone-500 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                      <span className="text-sm text-stone-600 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <button
                onClick={downloadFacebookTemplate}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl py-3 text-sm transition"
              >
                Download again
              </button>
            </>
          )}
        </section>
      )}

      {view === "main" && (
        <>

      {/* Stage 1: Upload */}
      {uploadedImages.length === 0 && items.length === 0 && (
        <section className="mb-10">
          <div
            className="border border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 transition-colors p-12 bg-white"
            onClick={() => fileRef.current?.click()}
          >
            <div className="w-10 h-10 mb-4 text-stone-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M12 3v13m0-13L8 7m4-4l4 4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-stone-700">Upload photos</p>
            <p className="text-xs text-stone-400 mt-1 font-light">AI will fill in names and descriptions — just add prices.</p>
            <p className="text-xs text-stone-300 mt-1 font-light">One photo per item.</p>
          </div>
        </section>
      )}

      {/* Stage 2: Fill in Details */}
      {uploadedImages.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-base font-medium text-stone-900">{uploadedImages.length} photo{uploadedImages.length !== 1 ? "s" : ""}</h2>
            <p className="text-xs text-stone-400 font-light">Edit anything — then add a price.</p>
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="space-y-4 mb-8">
            {uploadedImages.map((img) => (
              <div key={img.id} className="flex gap-4 items-start bg-white rounded-xl p-4 border border-stone-100">
                <img src={img.imageDataUrl} alt="preview" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder={img.loadingCaption ? "Analysing…" : "Item name"}
                    value={img.name}
                    disabled={img.loadingCaption}
                    onChange={(e) => updateUploadedImage(img.id, "name", e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:text-stone-300 transition"
                  />
                  <textarea
                    placeholder={img.loadingCaption ? "Analysing…" : "Description (optional)"}
                    value={img.description || ""}
                    disabled={img.loadingCaption}
                    onChange={(e) => updateUploadedImage(img.id, "description", e.target.value)}
                    rows={2}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none disabled:text-stone-300 transition"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 text-sm">$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={img.price}
                      onChange={(e) => updateUploadedImage(img.id, "price", e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-6 pr-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
                    />
                  </div>
                </div>
                <button onClick={() => removeUploadedImage(img.id)} className="text-stone-300 hover:text-stone-500 transition mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={confirmUploadedItems} className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-lg py-2.5 text-sm transition">
              Confirm items
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-lg py-2.5 text-sm transition">
              + Add more
            </button>
            <button onClick={() => setUploadedImages([])} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-lg py-2.5 text-sm transition">
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Confirmed items */}
      {items.length > 0 && uploadedImages.length === 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-medium text-stone-900">{items.length} item{items.length !== 1 ? "s" : ""}</h2>
            <div className="flex items-center gap-4">
              {!editingItems && (
                <button onClick={() => fileRef.current?.click()} className="text-xs text-stone-400 hover:text-stone-600 transition">
                  + Add more
                </button>
              )}
              <button
                onClick={() => setEditingItems((v) => !v)}
                className="text-xs text-stone-500 hover:text-stone-800 transition"
              >
                {editingItems ? "Done" : "Edit"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Start over? This will clear all your items.")) {
                    setItems([]);
                    setEditingItems(false);
                  }
                }}
                className="text-xs text-red-300 hover:text-red-500 transition"
              >
                Start over
              </button>
            </div>
          </div>

          {editingItems ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 items-start bg-white border border-stone-100 rounded-xl p-4">
                  <img src={item.imageDataUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
                    />
                    <textarea
                      value={item.description || ""}
                      placeholder="Description (optional)"
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      rows={2}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none transition"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 text-sm">$</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, "price", e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-6 pr-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 transition"
                      />
                    </div>
                  </div>
                  <button onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))} className="text-stone-300 hover:text-stone-500 transition mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-stone-100 overflow-hidden relative group">
                  <img src={item.imageDataUrl} alt={item.name} className="w-full h-36 object-cover" />
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                    <p className="text-sm text-stone-500 mt-0.5">${item.price}</p>
                  </div>
                  <button
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm text-stone-400 hover:text-stone-700 rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Action buttons */}
      {items.length > 0 && uploadedImages.length === 0 && !editingItems && (
        <section className="flex flex-col sm:flex-row gap-3 mb-10">
          <button
            onClick={generateDeck}
            disabled={loadingDeck}
            className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-medium rounded-xl py-3 text-sm transition"
          >
            {loadingDeck ? "Generating…" : "Export PDF"}
          </button>
          {/* Facebook Marketplace upload — hidden until ready
          <button
            onClick={() => { setFbDownloaded(false); setView("facebook"); }}
            className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl py-3 text-sm transition"
          >
            Facebook Marketplace upload
          </button>
          */}
        </section>
      )}

      {error && !uploadedImages.length && (
        <p className="text-red-400 text-sm mt-4">{error}</p>
      )}

      <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleMultipleImageUpload} />
      </>
      )}
    </main>
  );
}
