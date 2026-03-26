'use client';

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/utils/api";
import { X } from "lucide-react";
import * as XLSX from "xlsx";

type Range = "today" | "last_week" | "last_month" | "last_3_months" | null;

function getFilterStart(range: Range, dateParam: string | null): Date | null {
  const now = new Date();
  if (dateParam) {
    const d = new Date(dateParam);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (!range) return null;
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "last_week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "last_month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "last_3_months":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function getFilterEnd(dateParam: string | null): Date | null {
  if (!dateParam) return null;
  const d = new Date(dateParam);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getRangeLabel(range: Range, dateParam: string | null): string {
  if (dateParam) return new Date(dateParam).toLocaleDateString();
  if (!range) return "All Dogs";
  switch (range) {
    case "today": return "Today";
    case "last_week": return "Last Week";
    case "last_month": return "Last Month";
    case "last_3_months": return "Last 3 Months";
    default: return "All Dogs";
  }
}

export default function CaptureListPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <CaptureListContent />
    </Suspense>
  );
}

function CaptureListContent() {
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range") as Range;
  const dateParam = searchParams.get("date");

  const { data: dogs, isLoading } = api.task.getDogs.useQuery();

  const dogRecords = useMemo(() => {
    const all = dogs ?? [];
    const start = getFilterStart(rangeParam, dateParam);
    if (!start) return all;
    const end = getFilterEnd(dateParam);
    return all.filter((dog: any) => {
      if (!dog.createdAt) return false;
      const created = new Date(dog.createdAt);
      if (created < start) return false;
      if (end && created > end) return false;
      return true;
    });
  }, [dogs, rangeParam, dateParam]);

  const filterLabel = getRangeLabel(rangeParam, dateParam);

  const [selectedRecords, setSelectedRecords] = useState<boolean[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const syncSelectionLength = (length: number) => {
    if (selectedRecords.length !== length) {
      setSelectedRecords(new Array(length).fill(false));
    }
  };

  useEffect(() => {
    syncSelectionLength(dogRecords.length);
  }, [dogRecords.length]);

  const toggleSelectAll = () => {
    const allSelected = selectedRecords.every((selected) => selected);
    setSelectedRecords(new Array(dogRecords.length).fill(!allSelected));
  };

  const toggleSelectRecord = (index: number) => {
    const next = [...selectedRecords];
    next[index] = !next[index];
    setSelectedRecords(next);
  };

  const handleDownloadExcel = () => {
    const rows = dogRecords.map((dog: any) => ({
      "Dog ID": dog.dog_tag_id || dog.id,
      "Capture Date": dog.createdAt ? new Date(dog.createdAt).toLocaleDateString() : "-",
      "Location": dog.location || "-",
      "Gender": dog.gender || "-",
      "Status": dog.status || "captured",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Captured Dogs");
    XLSX.writeFile(wb, `captured-dogs-${filterLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
  };

  if (isLoading) {
    return <div className="p-8">Loading captured dogs...</div>;
  }

  return (
    <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capture List</h1>
          <p className="text-sm text-gray-600">
            {rangeParam || dateParam
              ? `Showing captures for: ${filterLabel}`
              : "All captured dogs"}
          </p>
        </div>
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Excel
        </button>
      </div>

      {/* Capture Dogs Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-center text-base font-semibold sm:text-left sm:text-lg">
            Capture List - {filterLabel === "All Dogs" ? "All Dogs" : filterLabel}
          </h2>
        </div>

        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[900px] sm:min-w-0">
            <thead className="border-y bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="w-8 px-2 py-3 sm:px-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={dogRecords.length > 0 && selectedRecords.every((s) => s)}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2 py-3 text-left sm:px-4 whitespace-nowrap">
                  Dog Photo
                </th>
                <th className="px-2 py-3 text-left sm:px-4 whitespace-nowrap">
                  Dog ID
                </th>
                <th className="px-2 py-3 text-left sm:px-4 whitespace-nowrap">
                  Capture Date
                </th>
                <th className="hidden px-2 py-3 text-left sm:table-cell sm:px-4 whitespace-nowrap">
                  Location
                </th>
                <th className="px-2 py-3 text-left sm:px-4 whitespace-nowrap">
                  Gender
                </th>
                <th className="px-2 py-3 text-left sm:px-4 whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {dogRecords.map((dog: any, index: number) => (
                <tr key={dog.id} className="hover:bg-gray-50">
                  <td className="px-2 py-4 align-top sm:px-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedRecords[index] ?? false}
                      onChange={() => toggleSelectRecord(index)}
                    />
                  </td>
                  <td className="px-2 py-4 align-top sm:px-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={dog.dogImageUrl || dog.dog_image_url || "/default-dog.png"}
                        alt={dog.dog_tag_id || dog.id}
                        className="h-10 w-10 cursor-pointer rounded-full object-cover transition-transform hover:scale-110"
                        onClick={() => setPreviewImage(dog.dogImageUrl || dog.dog_image_url || "/default-dog.png")}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = "/default-dog.png";
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-4 align-top sm:px-4">
                    <span className="text-blue-600 hover:underline">
                      {dog.dog_tag_id || dog.id}
                    </span>
                  </td>
                  <td className="px-2 py-4 align-top sm:px-4">
                    {dog.createdAt
                      ? new Date(dog.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="hidden px-2 py-4 align-top sm:table-cell sm:px-4">
                    {dog.location ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          dog.location,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {dog.location}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-2 py-4 align-top sm:px-4">
                    {dog.gender || "-"}
                  </td>
                  <td className="px-2 py-4 align-top sm:px-4">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                      {dog.status || "captured"}
                    </span>
                  </td>
                </tr>
              ))}
              {dogRecords.length === 0 && !isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No captured dogs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[80vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
            <img
              src={previewImage}
              alt="Dog preview"
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = "/default-dog.png";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
