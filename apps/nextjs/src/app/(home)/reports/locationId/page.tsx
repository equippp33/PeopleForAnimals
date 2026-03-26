"use client";

import { Suspense, useMemo, useState } from "react";
import type { FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";
import * as XLSX from 'xlsx';

import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";

interface Batch {
  id: string;
  batchNumber: string;
  operationTaskId: string;
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  totalDogs: number;
  capture_supervisor_name: string | null;
  capture_supervisor_photo: string | null;
  operationTask?: {
    circle?: {
      id?: string;
      name?: string;
      location?: {
        id?: string;
        name?: string;
        area?: string;
      };
    };
  };
  vehicle?: {
    name?: string | null;
    number?: string | null;
  };
}

interface Vehicle {
  id: string;
  name: string | null;
  vehicleNumber: string | null;
  vehicleColor: string | null;
  locationCoordinates: string | null;
  locationName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

const LocationReportPage: FC = () => {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('id');
  const router = useRouter();
  const [reportType, setReportType] = useState<'capture' | 'release'>('capture');
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterVehicle, setFilterVehicle] = useState<string>("");
  const [filterCircle, setFilterCircle] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const clearFilters = () => {
    setFilterDate("");
    setFilterVehicle("");
    setFilterCircle("");
  };

  const hasActiveFilters = filterDate || filterVehicle || filterCircle;

  const { data: vehicles, isLoading: isLoadingVehicles } =
    api.vehicle.getAllVehicles.useQuery();
  const { data: allBatches, isLoading: isLoadingBatches } = api.task.getAllBatches.useQuery();
  const { data: releaseTasks, isLoading: isLoadingRelease } = api.task.getAllReleaseTasks.useQuery();

  // Filter batches to only include those from circles in the current location
  const batches = useMemo(() => {
    if (!allBatches || !locationId) return [];
    return allBatches.filter(batch => {
      return batch.operationTask?.circle?.location?.id === locationId;
    });
  }, [allBatches, locationId]);

  // Map releaseTasks to batch-like objects
  const releaseBatches = useMemo(() => {
    if (!releaseTasks) return [] as Batch[];
    return releaseTasks.map((task) => ({
      id: task.batchId,
      batchNumber: task.batchNumber ?? '',
      operationTaskId: '',
      status: task.status,
      startTime: null,
      endTime: task.releaseDate ?? null,
      totalDogs: task.releasedDogs ?? 0,
      capture_supervisor_name: null,
      capture_supervisor_photo: task.releaseSupervisorPhoto ?? null,
      operationTask: {
        circle: task.circleId ? { id: task.circleId, name: task.circleName ?? undefined, location: { id: task.locationId ?? '', name: undefined, area: undefined } } : undefined,
      },
      vehicle: task.vehicle ? { name: task.vehicle.name, number: task.vehicle.vehicleNumber } : undefined,
    }));
  }, [releaseTasks]);

  // Batches to display based on report type and filters
  const displayedBatches = useMemo(() => {
    let list = reportType === 'capture' ? batches : releaseBatches;

    if (filterDate) {
      const filterDateStr = new Date(filterDate).toLocaleDateString();
      list = list.filter(batch => {
        const d = reportType === 'capture' ? batch.startTime : batch.endTime;
        if (!d) return false;
        return new Date(d).toLocaleDateString() === filterDateStr;
      });
    }

    if (filterVehicle) {
      list = list.filter(batch => batch.vehicle?.number === filterVehicle);
    }

    if (filterCircle) {
      list = list.filter(batch => batch.operationTask?.circle?.id === filterCircle);
    }

    return list;
  }, [batches, releaseBatches, reportType, filterDate, filterVehicle, filterCircle]);

  // circles for current location
  const circles = useMemo(() => {
    if (!allBatches || !locationId) return [] as { id?: string; name?: string }[];
    const set = new Map<string, { id?: string; name?: string }>();
    allBatches.forEach((batch) => {
      const circle = batch.operationTask?.circle;
      if (circle && circle.location?.id === locationId) {
        set.set(circle.id ?? '', { id: circle.id ?? undefined, name: circle.name ?? undefined });
      }
    });
    return Array.from(set.values());
  }, [allBatches, locationId]);

  const handleDownloadExcel = () => {
    if (!displayedBatches || displayedBatches.length === 0) return;

    // Prepare data for Excel
    const excelData = displayedBatches.map((batch, index) => ({
      'S.No': index + 1,
      'Batch ID': batch.batchNumber,
      [reportType === 'capture' ? 'Capture Date' : 'Release Date']: (reportType === 'capture' ? batch.startTime : batch.endTime) ? new Date((reportType === 'capture' ? batch.startTime : batch.endTime)!).toLocaleString() : 'N/A',
      'Vehicle Number': batch.vehicle?.number || 'N/A',
      'Location': batch.operationTask?.circle?.name || 'N/A',
      'Total Dogs': batch.totalDogs,
      'Supervisor Photo': ((): string => {
        const photo = batch.capture_supervisor_photo;
        if (!photo) return 'N/A';
        return photo.startsWith('http') ? photo : `https://pub-9f11b7d81f2a4c8db6b2a2c6d7c8f7f4.r2.dev/${photo}`;
      })(),
      'Status': batch.status || 'N/A',
      'Start Time': batch.startTime ? new Date(batch.startTime).toLocaleString() : 'N/A',
      'End Time': batch.endTime ? new Date(batch.endTime).toLocaleString() : 'N/A',
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Make Location column cells clickable Google Maps links
    const locationColumnKey = 'Location';
    const totalRows = excelData.length;
    // Header is on row 1, data starts from row 2
    for (let rowIndex = 2; rowIndex <= totalRows + 1; rowIndex++) {
      const dataIndex = rowIndex - 2;
      const locationName = excelData[dataIndex]?.[locationColumnKey];
      if (!locationName || locationName === 'N/A') continue;

      // Column E is the 5th column where 'Location' is written by json_to_sheet
      const cellAddress = `E${rowIndex}`;
      const cell = worksheet[cellAddress];
      if (!cell) continue;

      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        locationName,
      )}`;

      (cell as XLSX.CellObject).l = {
        Target: mapsUrl,
        Tooltip: `Open ${locationName} in Google Maps`,
      };
    }

    // Set column widths
    const wscols = [
      { wch: 5 },   // S.No
      { wch: 15 },  // Batch ID
      { wch: 20 },  // Capture Date
      { wch: 15 },  // Vehicle Number
      { wch: 20 },  // Location
      { wch: 10 },  // Total Dogs
      { wch: 20 },  // Supervisor
      { wch: 15 },  // Status
      { wch: 20 },  // Start Time
      { wch: 20 },  // End Time
    ];
    worksheet['!cols'] = wscols;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${reportType === 'capture' ? 'Capture' : 'Release'} Location Reports`);

    // Generate Excel file
    XLSX.writeFile(workbook, `location-reports-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleBatchClick = (batchId: string) => {
    const mode = reportType === 'release' ? 'release' : 'capture';
    router.push(`/reports/locationId/batchId?id=${batchId}&mode=${mode}`);
  };

  if (isLoadingVehicles || (reportType === 'capture' ? isLoadingBatches : isLoadingRelease)) {
    return <div className="p-8">Loading data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Operational reports</h1>
        <p className="text-sm text-gray-600">Capture and Release reports</p>
      </div>

      {/* Filters Section */}
      <div className="mb-8 rounded-xl bg-blue-500 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">Filters</h3>
        <p className="mb-4 text-sm text-blue-100">
          Filter by date, vehicle and location
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm text-white">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full rounded-md border-0 bg-white px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Vehicle</label>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full rounded-md border-0 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">All vehicles</option>
              {vehicles?.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.vehicleNumber ?? ""}>
                  {vehicle.vehicleNumber ?? "No number"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Circle</label>
            <select
              value={filterCircle}
              onChange={(e) => setFilterCircle(e.target.value)}
              className="w-full rounded-md border-0 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">All circles</option>
              {circles.map((c) => (
                <option key={c.id ?? c.name} value={c.id}>{c.name ?? "Unnamed"}</option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            Show All Reports
          </button>
        )}
      </div>

      {/* Report Type Tabs */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 sm:gap-4 border-b pb-2">
          <button
            onClick={() => setReportType('capture')}
            className={`${reportType === 'capture' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700'} px-4 py-2 text-sm font-medium`}
          >
            Capture reports
          </button>
          <button
            onClick={() => setReportType('release')}
            className={`${reportType === 'release' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-gray-700'} px-4 py-2 text-sm font-medium`}
          >
            Release reports
          </button>

        </div>
      </div>

      {/* Location Reports Section */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
          <h2 className="text-base sm:text-lg font-semibold text-center sm:text-left">
            {reportType === 'capture' ? 'Capture' : 'Release'} reports - {displayedBatches?.[0]?.operationTask?.circle?.name || 'Location'} Batches
          </h2>
          <Button
            onClick={handleDownloadExcel}
            disabled={!displayedBatches || displayedBatches.length === 0}
            className="flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[800px] sm:min-w-0">
            <thead className="border-y bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="w-8 px-2 sm:px-4 py-3">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Batch ID</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">{reportType === 'capture' ? 'Capture Date' : 'Release Date'}</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden sm:table-cell">Vehicle Number</th>
                <th className="px-2 sm:px-4 py-4 whitespace-nowrap hidden lg:table-cell">{reportType === 'capture' ? 'Capture Location' : 'Release Location'}</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Dogs</th>
                <th className="px-2 sm:px-4 py-4 whitespace-nowrap hidden md:table-cell">Supervisor</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y text-sm">
              {displayedBatches?.map((batch) => {

                return (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-4 align-top">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      <button
                        onClick={() => handleBatchClick(batch.id)}
                        className="text-blue-600 hover:underline"
                      >
                        {batch.batchNumber}
                      </button>
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      {reportType === 'capture'
                        ? batch.startTime ? new Date(batch.startTime).toLocaleDateString() : 'N/A'
                        : batch.endTime ? new Date(batch.endTime).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      {batch.vehicle?.number || 'N/A'}
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      {batch.operationTask?.circle?.name ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            batch.operationTask.circle.name,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {batch.operationTask.circle.name}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      {batch.totalDogs || 0}
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      {batch.capture_supervisor_photo ? (
                        <div className="flex items-center justify-center">
                          <img
                            src={batch.capture_supervisor_photo.startsWith('http')
                              ? batch.capture_supervisor_photo
                              : `https://pub-9f11b7d81f2a4c8db6b2a2c6d7c8f7f4.r2.dev/${batch.capture_supervisor_photo}`
                            }
                            alt={batch.capture_supervisor_name || 'Supervisor'}
                            className="h-12 w-12 cursor-pointer rounded-full object-cover transition-transform hover:scale-110"
                            onClick={() => setPreviewImage(
                              batch.capture_supervisor_photo!.startsWith('http')
                                ? batch.capture_supervisor_photo!
                                : `https://pub-9f11b7d81f2a4c8db6b2a2c6d7c8f7f4.r2.dev/${batch.capture_supervisor_photo}`
                            )}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = '/default-avatar.png';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                          <span className="text-gray-500">N/A</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-4 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${batch.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : batch.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {batch.status || 'unknown'}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
              alt="Supervisor preview"
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = '/default-avatar.png';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Page: FC = () => (
  <Suspense fallback={<div>Loading…</div>}>
    <LocationReportPage />
  </Suspense>
);

export default Page;
