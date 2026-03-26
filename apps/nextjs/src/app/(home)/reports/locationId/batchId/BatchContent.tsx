"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, X } from "lucide-react";
import * as XLSX from 'xlsx';

import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";

interface Coordinates {
  lat: number;
  lng: number;
}

interface CapturedDog {
  id: string;
  dogImageUrl: string;
  gender: string;
  location: string | null;
  coordinates: Coordinates | null;
  fullAddress: string | null;
  status: string;
  dogColor: string | null;
  weight: string | null;
  block: string | null;
  cageNo: string | null;
  surgeryStatus: string | null;
  surgeryReason: string | null;
  surgery_remarks: string | null;
  dog_tag_id: string | null;
  feederName: string | null;
  feederPhoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function BatchContent() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("id");
  const utils = api.useUtils();

  // Fetch dogs data using tRPC
  const mode = searchParams.get("mode") ?? "capture";
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: dogs, isLoading } = api.task.getDogsByBatchId.useQuery(
    { batchId: batchId! },
    {
      enabled: !!batchId,
      select: (data) => {
        const list = data as unknown as CapturedDog[];
        if (mode === "release") {
          return list.filter((d:any) => (d.releaseStatus ?? d.release_status) === "released");
        }
        return list;
      },
    },
  );

  const handleDownloadExcel = () => {
    if (!dogs || dogs.length === 0) return;

    // Prepare data for Excel
    const excelData = dogs.map((dog, index) => ({
      'S.No': index + 1,
        'Tag ID': dog.dog_tag_id || 'N/A',
      'Dog Photo': dog.dogImageUrl || dog.dog_image_url || 'N/A',
      'Color': dog.dogColor || 'N/A',
      'Gender': dog.gender || 'N/A',
      'Weight (kg)': dog.weight ? Number(dog.weight).toFixed(1) : 'N/A',
      'Block': dog.block || 'N/A',
      'Cage No': dog.cageNo || 'N/A',
      'Surgery Status': dog.surgeryStatus === 'yes' ? 'Done' : 'Pending',
      'Status': dog.status || 'N/A',
      'Location': dog.location || 'N/A',
      'Address': dog.fullAddress || 'N/A',
      'Feeder Name': dog.feederName || 'N/A',
      'Feeder Phone': dog.feederPhoneNumber || 'N/A',
      'Captured On': dog.createdAt ? new Date(dog.createdAt).toLocaleString() : 'N/A'
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dogs Data');
    
    // Generate Excel file
    XLSX.writeFile(workbook, `batch-${batchId}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateSurgeryStatus = api.surgery.updateDogSurgeryStatus.useMutation({
    onSuccess: async () => {
      await utils.task.getDogsByBatchId.invalidate({ batchId: batchId! });
    },
    onError: (error) => {
      console.error("Failed to update surgery status:", error);
    },
  });

  const toggleSurgeryStatus = async (dogId: string, currentStatus: string | null) => {
    const newStatus = currentStatus === "yes" ? "no" : "yes";
    updateSurgeryStatus.mutate({
      dogId,
      surgeryStatus: newStatus,
      surgeryReason: "Updated via BatchContent",
      surgery_remarks: "Status toggled"
    });
  };

  if (!batchId) {
    return <div className="p-8">Batch ID not provided</div>;
  }

  if (isLoading) {
    return <div className="p-8">Loading dogs data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Batch Details</h1>
        <p className="text-sm text-gray-600">
          View {mode === "release" ? "released" : "captured"} dogs in this batch
        </p>
      </div>

      {/* Dogs Table Section */}
      <div className="rounded-lg border bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
          <h2 className="text-base sm:text-lg font-semibold text-center sm:text-left">{mode === "release" ? "Released Dogs" : "Captured Dogs"}</h2>
          <Button 
            onClick={handleDownloadExcel}
            disabled={!dogs || dogs.length === 0}
            className="flex items-center justify-center gap-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[900px] sm:min-w-0">
            <thead className="border-y bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="w-8 px-2 sm:px-4 py-3">#</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Dog Photo</th>
        
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden sm:table-cell">Tag ID</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden md:table-cell">Color</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Gender</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden lg:table-cell">Weight (kg)</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden xl:table-cell">Block</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap hidden xl:table-cell">Cage No</th>
                <th className="px-2 sm:px-4 py-3 text-left whitespace-nowrap">Surgery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {dogs?.map((dog, index) => (
                <tr key={dog.id} className="hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-3 align-top">{index + 1}</td>
                  <td className="px-2 sm:px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <img
                        src={dog.dogImageUrl}
                        alt={`Dog ${dog.id}`}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover cursor-pointer transition-transform hover:scale-110"
                        onClick={() => setPreviewImage(dog.dogImageUrl)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = '/default-dog.png';
                        }}
                      />
                    </div>
                  </td>
                                    <td className="px-2 sm:px-4 py-3 align-top hidden sm:table-cell">
                    {dog.dog_tag_id || 'N/A'}
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-top hidden md:table-cell">
                    {dog.dogColor || 'N/A'}
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-top">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {dog.gender || 'N/A'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-top hidden lg:table-cell">
                    {dog.weight ? `${Number(dog.weight).toFixed(1)} kg` : 'N/A'}
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-top hidden xl:table-cell">
                    {dog.block || 'N/A'}
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-top hidden xl:table-cell">
                    {dog.cageNo || 'N/A'}
                  </td>
                  {mode === "release" ? (
                  <td className="px-4 py-3 text-green-700">
                   <span
                                            className={`inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-1 text-xs font-medium transition-colors w-full sm:w-auto ${
                        dog.surgeryStatus === 'yes'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                                          >
                      {updateSurgeryStatus.isPending && dog.id === updateSurgeryStatus.variables?.dogId ? (
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1"></span>
                      ) : null}
                      {dog.surgeryStatus === 'yes' ? '✓ Done' : ''}
                    </span>
                    </td>
                ) : (
                  <td className="px-4 py-3">
                    <span
                                            className={`inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-1 text-xs font-medium transition-colors w-full sm:w-auto ${
                        dog.surgeryStatus === 'yes'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                                          >
                      {updateSurgeryStatus.isPending && dog.id === updateSurgeryStatus.variables?.dogId ? (
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1"></span>
                      ) : null}
                      {dog.surgeryStatus === 'yes' ? '✓ Done' : ''}
                    </span>
                  </td>
                )}
                </tr>
              ))}
              {(!dogs || dogs.length === 0) && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No dogs found in this batch
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Preview Popup */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
