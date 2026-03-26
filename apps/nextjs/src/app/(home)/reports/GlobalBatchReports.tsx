'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Button } from '~/components/ui/button';
import { api } from '~/utils/api';

type Batch = {
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
};

export interface GlobalBatchReportsProps {
    initialReportType: 'capture' | 'release';
}

export function GlobalBatchReports({ initialReportType }: GlobalBatchReportsProps) {
    const router = useRouter();
    const [reportType, setReportType] = useState<'capture' | 'release'>(initialReportType);

    const { data: allBatches, isLoading: isLoadingBatches } = api.task.getAllBatches.useQuery();
    const { data: releaseTasks, isLoading: isLoadingRelease } = api.task.getAllReleaseTasks.useQuery();

    const captureBatches = useMemo(() => {
        if (!allBatches) return [] as Batch[];
        return allBatches as Batch[];
    }, [allBatches]);

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
                circle: task.circleId
                    ? {
                        id: task.circleId,
                        name: task.circleName ?? undefined,
                        location: {
                            id: task.locationId ?? '',
                            name: undefined,
                            area: undefined,
                        },
                    }
                    : undefined,
            },
            vehicle: task.vehicle
                ? { name: task.vehicle.name, number: task.vehicle.vehicleNumber }
                : undefined,
        }));
    }, [releaseTasks]);

    const displayedBatches = useMemo(() => {
        return reportType === 'capture' ? captureBatches : releaseBatches;
    }, [captureBatches, releaseBatches, reportType]);

    const handleDownloadExcel = () => {
        if (!displayedBatches || displayedBatches.length === 0) return;

        const excelData = displayedBatches.map((batch, index) => ({
            'S.No': index + 1,
            'Batch ID': batch.batchNumber,
            [reportType === 'capture' ? 'Capture Date' : 'Release Date']:
                (reportType === 'capture' ? batch.startTime : batch.endTime)
                    ? new Date(
                        (reportType === 'capture' ? batch.startTime : batch.endTime) as Date,
                    ).toLocaleString()
                    : 'N/A',
            'Vehicle Number': batch.vehicle?.number || 'N/A',
            Location: batch.operationTask?.circle?.name || 'N/A',
            Dogs: batch.totalDogs,
            Status: batch.status || 'N/A',
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            `${reportType === 'capture' ? 'Capture' : 'Release'} Global Batches`,
        );
        XLSX.writeFile(
            workbook,
            `batch-reports-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`,
        );
    };

    const handleBatchClick = (batchId: string) => {
        const mode = reportType === 'release' ? 'release' : 'capture';
        router.push(`/reports/locationId/batchId?id=${batchId}&mode=${mode}`);
    };

    if (isLoadingBatches || isLoadingRelease) {
        return <div className="p-8">Loading data...</div>;
    }

    return (
        <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Dog Operation Batches</h1>
                <p className="text-sm text-gray-600">
                    View capture and release batches across all locations
                </p>
            </div>

            <div className="mb-8">
                <div className="flex flex-wrap gap-2 border-b pb-2 sm:gap-4">
                    <button
                        onClick={() => setReportType('capture')}
                        className={`${reportType === 'capture'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-gray-700'
                            } px-4 py-2 text-sm font-medium`}
                    >
                        Capture reports
                    </button>
                    <button
                        onClick={() => setReportType('release')}
                        className={`${reportType === 'release'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-gray-700'
                            } px-4 py-2 text-sm font-medium`}
                    >
                        Release reports
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-white">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-center text-base font-semibold sm:text-left sm:text-lg">
                        {reportType === 'capture' ? 'Capture' : 'Release'} reports - All Batches
                    </h2>
                    <Button
                        onClick={handleDownloadExcel}
                        disabled={!displayedBatches || displayedBatches.length === 0}
                        className="flex w-full items-center justify-center gap-2 bg-blue-500 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-base"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </Button>
                </div>

                <div className="-mx-2 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[800px] sm:min-w-0">
                        <thead className="border-y bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="w-8 px-2 py-3 sm:px-4">
                                    <input type="checkbox" className="rounded border-gray-300" />
                                </th>
                                <th className="whitespace-nowrap px-2 py-3 text-left sm:px-4">Batch ID</th>
                                <th className="whitespace-nowrap px-2 py-3 text-left sm:px-4">
                                    {reportType === 'capture' ? 'Capture Date' : 'Release Date'}
                                </th>
                                <th className="hidden whitespace-nowrap px-2 py-3 text-left sm:table-cell sm:px-4">
                                    Vehicle Number
                                </th>
                                <th className="hidden whitespace-nowrap px-2 py-4 lg:table-cell sm:px-4">
                                    {reportType === 'capture' ? 'Capture Location' : 'Release Location'}
                                </th>
                                <th className="whitespace-nowrap px-2 py-3 text-left sm:px-4">Dogs</th>
                                <th className="hidden whitespace-nowrap px-2 py-4 md:table-cell sm:px-4">Supervisor</th>
                                <th className="whitespace-nowrap px-2 py-3 text-left sm:px-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {displayedBatches?.map((batch) => (
                                <tr key={batch.id} className="hover:bg-gray-50">
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                    </td>
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        <button
                                            onClick={() => handleBatchClick(batch.id)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {batch.batchNumber}
                                        </button>
                                    </td>
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        {reportType === 'capture'
                                            ? batch.startTime
                                                ? new Date(batch.startTime).toLocaleDateString()
                                                : 'N/A'
                                            : batch.endTime
                                                ? new Date(batch.endTime).toLocaleDateString()
                                                : 'N/A'}
                                    </td>
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        {batch.vehicle?.number || 'N/A'}
                                    </td>
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        {batch.operationTask?.circle?.name || 'N/A'}
                                    </td>
                                    <td className="px-2 py-4 align-top sm:px-4">{batch.totalDogs || 0}</td>
                                    <td className="px-2 py-4 align-top sm:px-4">
                                        {batch.capture_supervisor_photo ? (
                                            <div className="flex items-center justify-center">
                                                <img
                                                    src={
                                                        batch.capture_supervisor_photo.startsWith('http')
                                                            ? batch.capture_supervisor_photo
                                                            : `https://pub-9f11b7d81f2a4c8db6b2a2c6d7c8f7f4.r2.dev/${batch.capture_supervisor_photo}`
                                                    }
                                                    alt={batch.capture_supervisor_name || 'Supervisor'}
                                                    className="h-12 w-12 rounded-full object-cover"
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
                                    <td className="px-2 py-4 align-top sm:px-4">
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
