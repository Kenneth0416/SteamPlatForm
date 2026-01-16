import type { ExportTemplate } from "@/lib/export/types"

export type PdfTemplateStyles = {
  page: Record<string, unknown>
  title: Record<string, unknown>
  heading: Record<string, unknown>
  paragraph: Record<string, unknown>
  list: Record<string, unknown>
  listItem: Record<string, unknown>
  table: Record<string, unknown>
  tableRow: Record<string, unknown>
  tableCell: Record<string, unknown>
  footer: Record<string, unknown>
  image: Record<string, unknown>
}

const base: PdfTemplateStyles = {
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "NotoSansTC",
    fontSize: 11,
    color: "#111827",
    lineHeight: 1.45,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 10,
  },
  heading: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    color: "#111827",
  },
  paragraph: {
    fontSize: 11,
    marginBottom: 6,
    color: "#111827",
  },
  list: {
    marginBottom: 8,
  },
  listItem: {
    fontSize: 11,
    marginBottom: 4,
  },
  table: {
    fontFamily: "Courier",
    fontSize: 9.5,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCell: {
    flexGrow: 1,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  footer: {
    marginTop: 18,
    fontSize: 9,
    color: "#6B7280",
  },
  image: {
    width: "100%",
    maxHeight: 260,
    objectFit: "contain",
    marginBottom: 10,
    borderRadius: 6,
    alignSelf: "center",
  },
}

const standard: PdfTemplateStyles = {
  ...base,
}

const detailed: PdfTemplateStyles = {
  ...base,
  page: { ...base.page, paddingHorizontal: 36, fontSize: 10.5 },
  title: { ...base.title, fontSize: 18 },
  heading: { ...base.heading, fontSize: 12.5, marginTop: 12 },
}

const minimal: PdfTemplateStyles = {
  ...base,
  page: { ...base.page, paddingHorizontal: 46, fontSize: 11.5 },
  title: { ...base.title, fontSize: 22, marginBottom: 14 },
  heading: { ...base.heading, fontSize: 12, marginTop: 10 },
}

export function getPdfStyles(template: ExportTemplate): PdfTemplateStyles {
  switch (template) {
    case "detailed":
      return detailed
    case "minimal":
      return minimal
    case "standard":
    default:
      return standard
  }
}
