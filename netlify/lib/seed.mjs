// Seed data for the 2026 Environmental Compliance Calendar.
// Loaded into the shared store the first time the site runs. After that, the
// store is the source of truth — edit tasks in the app, not here.

const pad = (n) => String(n).padStart(2, "0");
const d = (y, m, day) => `${y}-${pad(m)}-${pad(day)}`;
const eom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function t(site, category, title, dueDate, frequency, extra = {}) {
  return {
    site,
    category,
    title,
    dueDate,
    frequency,
    submittedTo: extra.submittedTo || "",
    responsible: extra.responsible || "",
    citation: extra.citation || "",
    inspectionType: extra.inspectionType || "",
    notes: extra.notes || "",
  };
}

function monthly(site, category, title, dayFn, extra = {}) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const e = typeof extra === "function" ? extra(m) : extra;
    out.push(t(site, category, `${title} — ${MONTHS[m - 1]}`, d(2026, m, dayFn(m)), "Monthly", e));
  }
  return out;
}

export function buildSeed() {
  const tasks = [];
  const push = (...xs) => tasks.push(...xs.flat());

  // ═══════════════ CHICAGO ═══════════════
  push(
    monthly("Chicago", "SPCC", "Monthly SPCC Checklist", (m) => eom(2026, m), { submittedTo: "Recordkeeping" }),
    monthly("Chicago", "Reporting", "Monthly Natural Gas Usage Report", (m) => eom(2026, m), { submittedTo: "Recordkeeping" }),
    t("Chicago", "Permits/Fees", "City of Chicago Liquid Waste Fee", d(2026, 1, 30), "Annual", { submittedTo: "City of Chicago" }),
    t("Chicago", "Permits/Fees", "Certificate of Operation — Process Equipment & Air Pollution Control", d(2026, 1, 31), "Annual", { submittedTo: "Chicago Dept. of Public Health" }),
    t("Chicago", "Water/Wastewater", "MWRD Annual RD-925 User Charge Report", d(2026, 2, 20), "Annual", { submittedTo: "MWRD" }),
    t("Chicago", "Chemical Inventory", "CWC Unscheduled Discrete Organic Chemicals Declaration", d(2026, 2, 28), "Annual", { submittedTo: "US Dept of Commerce BIS" }),
    t("Chicago", "Waste", "Annual Waste Generation Report", d(2026, 2, 28), "Annual", { submittedTo: "Senior Management", notes: "Internal report to senior management" }),
    t("Chicago", "Chemical Inventory", "IEPA SARA Section 312 Tier II", d(2026, 3, 1), "Annual", { submittedTo: "IEPA" }),
    t("Chicago", "Air", "Greenhouse Gas Reporting", d(2026, 3, 31), "Annual", { submittedTo: "IEPA / US EPA", notes: "Coordinate with Robin D. (regulatory/corporate)" }),
    t("Chicago", "Permits/Fees", "Annual FESOP Fee", d(2026, 3, 31), "Annual", { submittedTo: "IEPA", notes: "Due 45 days after billing date — adjust due date when bill is received" }),
    t("Chicago", "Water/Wastewater", "MWRD Continued Compliance Testing — Spring Notification", d(2026, 4, 17), "Semi-Annual", { submittedTo: "MWRD", notes: "Notification due 14 days before testing (testing complete by 5/1)" }),
    t("Chicago", "Air", "IEPA Annual Emission Report (AER)", d(2026, 5, 1), "Annual", { submittedTo: "IEPA" }),
    t("Chicago", "Water/Wastewater", "MWRD Continued Compliance Testing — Spring", d(2026, 5, 1), "Semi-Annual", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Water/Wastewater", "MWRD RD-115 Continued Compliance Report — Period 1", d(2026, 6, 1), "Semi-Annual", { submittedTo: "MWRD" }),
    t("Chicago", "Permits/Fees", "Illinois Dept. of Revenue PTAX-401", d(2026, 6, 1), "Annual", { submittedTo: "IL Dept of Revenue" }),
    t("Chicago", "Air", "Semi-Annual Leak Detection Monitoring Report — Period 1 (GD2 Luwa)", d(2026, 6, 30), "Semi-Annual", { submittedTo: "IEPA" }),
    t("Chicago", "Chemical Inventory", "IEPA SARA TRI Form R", d(2026, 7, 1), "Annual", { submittedTo: "IEPA / US EPA" }),
    t("Chicago", "Chemical Inventory", "ATF Denatured Alcohol Report", d(2026, 7, 15), "Annual", { submittedTo: "ATF (TTB)" }),
    t("Chicago", "Water/Wastewater", "MWRD User Charge Testing Notification", d(2026, 8, 17), "Annual", { submittedTo: "MWRD", notes: "Notification due 14 days before testing" }),
    t("Chicago", "Water/Wastewater", "MWRD Continued Compliance Testing — Fall Notification", d(2026, 10, 17), "Semi-Annual", { submittedTo: "MWRD", notes: "Notification due 14 days before testing (testing complete by 11/1)" }),
    t("Chicago", "Water/Wastewater", "MWRD Continued Compliance Testing — Fall", d(2026, 11, 1), "Semi-Annual", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Water/Wastewater", "MWRD RD-115 Continued Compliance Report — Period 2", d(2026, 12, 1), "Semi-Annual", { submittedTo: "MWRD" }),
    t("Chicago", "SPCC", "Annual SPCC Refresher Training", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping" }),
    t("Chicago", "SPCC", "Annual SPCC Tank Inspections", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping" }),
    t("Chicago", "Air", "Semi-Annual Leak Detection Monitoring Report — Period 2 (GD2 Luwa)", d(2026, 12, 31), "Semi-Annual", { submittedTo: "IEPA" }),
    t("Chicago", "Water/Wastewater", "MWRD User Charge Sampling (RD-920)", d(2026, 12, 31), "Annual", { submittedTo: "MWRD", notes: "Minimum 1 round/year. Notification 14 days before; RD-920 report due 45 days after sampling" }),
    t("Chicago", "Water/Wastewater", "MWRD Quarterly On-Site Inspection — Q1", d(2026, 3, 31), "Quarterly", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Water/Wastewater", "MWRD Quarterly On-Site Inspection — Q2", d(2026, 6, 30), "Quarterly", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Water/Wastewater", "MWRD Quarterly On-Site Inspection — Q3", d(2026, 9, 30), "Quarterly", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Water/Wastewater", "MWRD Quarterly On-Site Inspection — Q4", d(2026, 12, 31), "Quarterly", { submittedTo: "MWRD", inspectionType: "Agency Inspection" }),
    t("Chicago", "Safety", "OSHA VPP Program Inspection", d(2026, 7, 6), "Annual", { submittedTo: "OSHA", inspectionType: "Agency Inspection" }),
    t("Chicago", "Safety", "Chicago Fire Department Inspection", d(2026, 8, 1), "Annual", { submittedTo: "Chicago Fire Dept", inspectionType: "Agency Inspection" }),
    t("Chicago", "Air", "IEPA Air Inspection (3-year cycle)", d(2028, 12, 31), "Multi-Year", { submittedTo: "IEPA", inspectionType: "Agency Inspection" }),
  );

  // ═══════════════ GURNEE ═══════════════
  const gResp = (m) => (m <= 3 ? "MM" : m <= 6 ? "JR" : "RD");
  push(
    monthly("Gurnee", "Water/Wastewater", "Monthly Water Flow Report", () => 5, { submittedTo: "NSWRD — John Reuskens", responsible: "RD" }),
    monthly("Gurnee", "Air", "Monthly Air Emission Calculation", (m) => ([4, 7, 10].includes(m) ? 20 : eom(2026, m)), { submittedTo: "Recordkeeping", responsible: "RD", notes: "Prior month data" }),
    monthly("Gurnee", "SPCC", "Monthly SPCC Inspection", (m) => eom(2026, m), (m) => ({ submittedTo: "Recordkeeping", responsible: gResp(m) })),
    monthly("Gurnee", "Water/Wastewater", "Monthly Stormwater Inspection", (m) => eom(2026, m), (m) => ({ submittedTo: "Recordkeeping", responsible: gResp(m) })),
  );
  [["Q4-2025 (10/1–12/31/25)", 1], ["Q1 (1/1–3/31/26)", 4], ["Q2 (4/1–6/30/26)", 7], ["Q3 (7/1–9/30/26)", 10]].forEach(([q, m]) =>
    push(t("Gurnee", "Water/Wastewater", `Quarterly Water Report ${q}`, d(2026, m, 5), "Quarterly", { submittedTo: "NSWRD — John Reuskens", responsible: "RD" })));
  [["Q1", 3, 31, "MM"], ["Q2", 6, 30, "JR"], ["Q3", 9, 30, "RD"], ["Q4", 12, 31, "RD"]].forEach(([q, m, day, r]) =>
    push(t("Gurnee", "Water/Wastewater", `Quarterly Stormwater Inspection ${q}`, d(2026, m, day), "Quarterly", { submittedTo: "Recordkeeping", responsible: r, notes: "Daylight hours, within 1 hour of start of rain or snowmelt event" })));
  [["Q4-2025", 1], ["Q1", 4], ["Q2", 7], ["Q3", 10]].forEach(([q, m]) => {
    push(t("Gurnee", "Air", `EO Permit Quarterly Report ${q}`, d(2026, m, 30), "Quarterly", { submittedTo: "IEPA Bureau of Air, Compliance Section #40", responsible: "RD" }));
    push(t("Gurnee", "Air", `QAP Plan Quarterly Report ${q}`, d(2026, m, 30), "Quarterly", { submittedTo: "IEPA Bureau of Air, Compliance Section #40", responsible: "RD" }));
  });
  [["Q1 (12/1/25–2/28/26)", 3, 31], ["Q2 (3/1–5/31/26)", 6, 30], ["Q3 (6/1–8/31/26)", 9, 30], ["Q4 (9/1–11/30/26)", 12, 31]].forEach(([q, m, day]) =>
    push(t("Gurnee", "Air", `Subpart Q LDAR Quarterly Report ${q}`, d(2026, m, day), "Quarterly", { submittedTo: "IEPA Division of Air Pollution Control", responsible: "RD" })));
  [["Q1", 3, 31], ["Q2", 6, 30], ["Q3", 9, 30], ["Q4", 12, 28]].forEach(([q, m, day]) => {
    push(t("Gurnee", "Air", `Quarterly RATA to Flowmeter ${q}`, d(2026, m, day), "Quarterly", { submittedTo: "IEPA", responsible: "RD" }));
    push(t("Gurnee", "Air", `Quarterly QC/QA to CEMS & Test Alarms ${q}`, d(2026, m, day), "Quarterly", { submittedTo: "Recordkeeping", responsible: "RD", notes: "Montrose" }));
  });
  push(
    t("Gurnee", "Air", "Semi-Annual Monitoring Report SAMR + CAM — Period 1 (Jul–Dec 2025)", d(2026, 1, 31), "Semi-Annual", { submittedTo: "IEPA DAPC MC40", responsible: "RD", notes: "2520 West Iles Ave, PO Box 19276, Springfield IL 62794-9276" }),
    t("Gurnee", "Air", "Semi-Annual Monitoring Report SAMR + CAM — Period 2 (Jan–Jun 2026)", d(2026, 7, 31), "Semi-Annual", { submittedTo: "IEPA DAPC MC40", responsible: "RD" }),
    t("Gurnee", "Air", "40 CFR 60 Subpart VVa Report (Aug 2025–Jan 2026)", d(2026, 2, 28), "Semi-Annual", { submittedTo: "IEPA DAPC MC40", responsible: "RD", notes: "Data from Montrose" }),
    t("Gurnee", "Air", "40 CFR 60 Subpart VVa Report (Feb–Jul 2026)", d(2026, 8, 31), "Semi-Annual", { submittedTo: "IEPA DAPC MC40", responsible: "RD", notes: "Data from Montrose" }),
    t("Gurnee", "Safety", "OSHA 300 Log Posting", d(2026, 2, 1), "Annual", { submittedTo: "Site posting" }),
    t("Gurnee", "Safety", "Emergency Generators 12-Month PM", d(2026, 2, 5), "Annual", { submittedTo: "Maintenance records", citation: "40 CFR 63.6650(h)", notes: "No annual reporting requirement; maintain hardcopy and electronic records" }),
    t("Gurnee", "Water/Wastewater", "Semi-Annual Report to NSWRD (7/1/25–12/31/25)", d(2026, 2, 20), "Semi-Annual", { submittedTo: "NSWRD — John Reuskens", responsible: "RD", notes: "Non-categorical significant industrial user" }),
    t("Gurnee", "Chemical Inventory", "CWC Unscheduled Discrete Organic Chemical Declaration", d(2026, 2, 28), "Annual", { submittedTo: "US Dept of Commerce BIS", responsible: "RD" }),
    t("Gurnee", "Waste", "Illinois Annual Hazardous Waste Report (LQG) + $500 fee", d(2026, 3, 1), "Annual", { submittedTo: "IEPA", responsible: "RD" }),
    t("Gurnee", "Chemical Inventory", "EPCRA 312 Tier II", d(2026, 3, 1), "Annual", { submittedTo: "IEPA / Lake County LEPC / Gurnee Fire Dept", responsible: "RD", notes: "File via Tier II Manager. Hard copies: Gurnee Fire Dept, 4580 Old Grand Ave, Gurnee IL 60031; Lake County LEPC, 1303 N Milwaukee Ave, Libertyville IL 60048" }),
    t("Gurnee", "Permits/Fees", "Annual Air Pollution Control Title V Permit Fee", d(2026, 4, 29), "Annual", { submittedTo: "IEPA Fiscal Services #2", responsible: "RD", notes: "PO Box 19276, Springfield IL 62794-9276" }),
    t("Gurnee", "Water/Wastewater", "Annual Calibration Reports (Flowmeters & Wastewater Samplers)", d(2026, 4, 30), "Annual", { submittedTo: "NSWRD — John Reuskens", responsible: "RD", notes: "Physical copy, postmarked by 4/30. PO Box 750, 14770 W. Wm. Koepsel Dr, Gurnee IL 60031" }),
    t("Gurnee", "Air", "Annual Compliance Certification", d(2026, 5, 1), "Annual", { submittedTo: "IEPA DAPC", responsible: "RD" }),
    t("Gurnee", "Air", "Annual Emission Report (AER)", d(2026, 5, 1), "Annual", { submittedTo: "IEPA DAPC — Air Quality Planning Section #39", responsible: "RD" }),
    t("Gurnee", "Safety", "Fire Water Pump PM (Annual)", d(2026, 5, 1), "Annual", { submittedTo: "Maintenance records", responsible: "Maintenance" }),
    t("Gurnee", "Chemical Inventory", "EPCRA 313 TRI Report", d(2026, 6, 30), "Annual", { submittedTo: "US EPA via TRI-MEweb", responsible: "RD", notes: "TRI Facility ID 60031MZRCC3839" }),
    t("Gurnee", "Water/Wastewater", "NPDES Annual Facility Inspection Report", d(2026, 6, 30), "Annual", { submittedTo: "IEPA DWPC Compliance Assurance Section #19", responsible: "RD", notes: "Email epa.indannualinsp@illinois.gov and mail hard copy" }),
    t("Gurnee", "Permits/Fees", "Annual NPDES Fee (Jul 2025–Jun 2026)", d(2026, 8, 1), "Annual", { submittedTo: "IEPA Fiscal Services #2", responsible: "RD", notes: "Check via Vantage AP" }),
    t("Gurnee", "Air", "Schedule Annual RATA to CEMS and Flow Meter", d(2026, 8, 1), "Annual", { submittedTo: "IEPA", responsible: "RD" }),
    t("Gurnee", "Water/Wastewater", "Semi-Annual Report to NSWRD (1/1/26–6/30/26)", d(2026, 8, 20), "Semi-Annual", { submittedTo: "NSWRD — John Reuskens", responsible: "RD" }),
    t("Gurnee", "Air", "Visible Emissions / Opacity Observation", d(2026, 10, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "RD" }),
    t("Gurnee", "SPCC", "Annual SPCC Inspection", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "Production" }),
    t("Gurnee", "Air", "Annual Subpart RR Exemption Review", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "TW" }),
    t("Gurnee", "Safety", "Sasol EO Supplier Audit", d(2026, 2, 1), "Annual", { inspectionType: "Supplier Audit" }),
    t("Gurnee", "Safety", "OSHA Inspection", d(2026, 10, 31), "Annual", { submittedTo: "OSHA", inspectionType: "Agency Inspection" }),
    t("Gurnee", "Air", "EO Operating Permit Inspection", d(2026, 12, 15), "Annual", { submittedTo: "IEPA", inspectionType: "Agency Inspection" }),
    t("Gurnee", "Safety", "PSM Compliance Audit (3-year)", d(2028, 10, 14), "Multi-Year", { inspectionType: "Internal" }),
  );

  // ═══════════════ CARNEGIE (Mallet) — from site permits/plans ═══════════════
  const AIR = "ACHD Operating Permit #0940-OP24";
  const ACHD = "Allegheny County Health Dept — Air Quality (Regulated Entities Portal / aqreports@alleghenycounty.us)";
  push(
    monthly("Carnegie", "Air", "Baghouse & Vacuum Blower Preventive Maintenance Inspection", (m) => eom(2026, m), {
      submittedTo: "Baghouse maintenance log", responsible: "RH", citation: `${AIR} §V.A.3.b`,
      notes: "Also confirm weekly baghouse ΔP readings (2.0–16.0 in. w.c.) are logged (§V.A.4.a) and daily visible-emission stack checks are done (§V.A.3.c)",
    }),
    t("Carnegie", "Air", "Semiannual Monitoring Report (Jul 1–Dec 31, 2025)", d(2026, 2, 1), "Semi-Annual", { submittedTo: ACHD, responsible: "RH", citation: `${AIR} §III.15.d, §V.A.5`, notes: "Weekly ΔP records, inspection dates/results, corrective actions; certified by Responsible Official" }),
    t("Carnegie", "Air", "Annual Certification of Compliance", d(2026, 2, 28), "Annual", { submittedTo: ACHD, responsible: "RH", citation: `${AIR} §III.12` }),
    t("Carnegie", "Air", "Semiannual Monitoring Report (Jan 1–Jun 30, 2026)", d(2026, 7, 31), "Semi-Annual", { submittedTo: ACHD, responsible: "RH", citation: `${AIR} §III.15.d, §V.A.5` }),
    t("Carnegie", "Permits/Fees", "Annual Operating Permit Maintenance Fee (CY2027)", d(2026, 12, 31), "Annual", { submittedTo: "Allegheny County Air Pollution Control Fund", responsible: "RH", citation: `${AIR} §III.24`, notes: "Late payment: 50% civil penalty plus interest (§III.30)" }),
    t("Carnegie", "Permits/Fees", "Air Operating Permit Renewal Application", d(2028, 8, 13), "Multi-Year", { submittedTo: "ACHD Air Quality", responsible: "RH", citation: `${AIR} §III.22`, notes: "Submit 6–18 months before 2/13/2029 expiration (window opens 8/13/2027)" }),
  );
  const PPC = "Stormwater PPC Plan / PAG-03 General Permit";
  push(
    t("Carnegie", "Water/Wastewater", "Stormwater Semiannual DMR (Jul 1–Dec 31, 2025)", d(2026, 1, 28), "Semi-Annual", { submittedTo: "PA DEP eDMR", responsible: "RH", citation: `${PPC} §5.2`, notes: "Separate DMR per outfall" }),
    t("Carnegie", "Water/Wastewater", "Stormwater PAG-03 Annual Report (CY2025)", d(2026, 5, 1), "Annual", { submittedTo: "PA DEP", responsible: "RH", citation: `${PPC} §7.3`, notes: "DEP template 3850-PM-BCW0083h; include inspection results and training documentation" }),
    t("Carnegie", "Water/Wastewater", "Stormwater Outfall Sampling — 1st Half 2026", d(2026, 6, 30), "Semi-Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §5.1`, notes: "Grab sample per outfall, qualifying storm (>0.1 in, 72 hr since last event), within first 30 min of discharge" }),
    t("Carnegie", "Water/Wastewater", "Stormwater Routine BMP Inspection — 1st Half 2026", d(2026, 6, 30), "Semi-Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §6.6`, notes: "At least one inspection per year must occur during a discharge" }),
    t("Carnegie", "Water/Wastewater", "Stormwater Semiannual DMR (Jan 1–Jun 30, 2026)", d(2026, 7, 28), "Semi-Annual", { submittedTo: "PA DEP eDMR", responsible: "RH", citation: `${PPC} §5.2` }),
    t("Carnegie", "Water/Wastewater", "Stormwater Outfall Sampling — 2nd Half 2026", d(2026, 12, 31), "Semi-Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §5.1` }),
    t("Carnegie", "Water/Wastewater", "Stormwater Routine BMP Inspection — 2nd Half 2026", d(2026, 12, 31), "Semi-Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §6.6` }),
    t("Carnegie", "Water/Wastewater", "Annual Comprehensive Site Evaluation & PPC Plan Review", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §7.1–7.2`, notes: "Plan sets annual frequency but no fixed date — due date set to year-end; adjust if needed" }),
    t("Carnegie", "Water/Wastewater", "Annual Stormwater Pollution Prevention Training", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${PPC} §6.7`, notes: "Document in the PAG-03 Annual Report" }),
  );
  const SPCC = "Carnegie SPCC Plan (Trinity, Sept 2020)";
  push(
    monthly("Carnegie", "SPCC", "Monthly SPCC Facility Walk-Around Inspection", (m) => eom(2026, m), {
      submittedTo: "Appendix H inspection forms", responsible: "RH", citation: `${SPCC} §8`,
      notes: "Covers tanks, containment, loading areas, piping/valves, spill kits. Weekly inspection of outdoor drum/tote staging area also required",
    }),
    t("Carnegie", "SPCC", "Annual Oil Storage Tank Inspection", d(2026, 12, 31), "Annual", { submittedTo: "Appendix H tank forms", responsible: "RH", citation: `${SPCC} §8; 40 CFR 112.8(c)(6)`, notes: "Integrity testing per STI SP001 / API 653 / FTPI schedule in Appendix F" }),
    t("Carnegie", "SPCC", "Annual Liquid Level Sensing Device Test", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${SPCC} §15; 40 CFR 112.8(c)(8)` }),
    t("Carnegie", "SPCC", "Annual SPCC Training & Spill Prevention Briefing", d(2026, 12, 31), "Annual", { submittedTo: "Recordkeeping", responsible: "RH", citation: `${SPCC} §9.1, §9.3; 40 CFR 112.7(f)`, notes: "Retain attendance records 3 years" }),
    t("Carnegie", "SPCC", "SPCC Plan Five-Year Review & PE Recertification", d(2025, 9, 29), "Multi-Year", { submittedTo: "Recordkeeping (Appendix B Review Log)", responsible: "RH", citation: "40 CFR 112.5(b)", notes: "Last PE certification 9/29/2020. Recertification lapsed Sept 2025; IMEG engaged for PE recertification" }),
    t("Carnegie", "Safety", "CV Technologies Fire Mitigation Inspection — F Bay", d(2026, 12, 5), "Annual", { inspectionType: "Third Party" }),
    t("Carnegie", "Safety", "American Contracting Enterprises Asbestos Inspection", d(2026, 12, 10), "Annual", { inspectionType: "Third Party" }),
  );

  // ═══════════════ ENGLEWOOD ═══════════════
  push(
    t("Englewood", "Safety", "Fire Department Inspection", d(2026, 9, 15), "Annual", { inspectionType: "Agency Visit" }),
    t("Englewood", "Safety", "Fire Department Inspection (second visit)", d(2026, 9, 17), "Annual", { inspectionType: "Agency Visit", notes: "Findings TBD" }),
  );

  // ═══════════════ LEUNA ═══════════════ (placeholders until site data arrives)
  push(
    t("Leuna", "Air", "[PLACEHOLDER] Annual emissions declaration (BImSchG)", d(2026, 4, 30), "Annual", { notes: "Placeholder — confirm requirement and due date with Leuna site" }),
    t("Leuna", "Water/Wastewater", "[PLACEHOLDER] Wastewater reporting (WHG)", d(2026, 5, 31), "Annual", { notes: "Placeholder — confirm requirement and due date with Leuna site" }),
  );

  // ═══════════════ FAIRFIELD ═══════════════ (from inspection calendar)
  [[2, "Q1"], [5, "Q2"], [8, "Q3"], [11, "Q4"]].forEach(([m, q]) =>
    push(t("Fairfield", "Safety", `360Fire Quarterly Fire Inspection ${q}`, d(2026, m, 15), "Quarterly", { inspectionType: "Third Party" })));
  push(
    t("Fairfield", "Safety", "Fire Inspection (quarterly)", d(2026, 3, 15), "Quarterly", { inspectionType: "Third Party" }),
    t("Fairfield", "Safety", "Fire Inspection (quarterly) and annual report", d(2026, 5, 15), "Annual", { inspectionType: "Third Party" }),
    t("Fairfield", "Safety", "Fire Department Inspection", d(2026, 5, 15), "Annual", { inspectionType: "Agency Visit" }),
  );

  // assign stable ids + default state
  const seen = new Set();
  return tasks.map((x) => {
    let id = `${x.site}-${x.dueDate}-${slug(x.title)}`.toLowerCase();
    while (seen.has(id)) id += "-x";
    seen.add(id);
    return {
      id,
      ...x,
      year: Number(x.dueDate.slice(0, 4)),
      status: "Not Started",
      completedDate: "",
      completedBy: "",
      statusNote: "",
      updatedAt: "",
      updatedBy: "",
    };
  });
}
