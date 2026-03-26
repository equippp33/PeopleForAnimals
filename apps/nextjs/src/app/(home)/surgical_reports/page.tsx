'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

interface BatchReport {
    batchId: string;
    date: string;
    location: string;
    dogsCaptured: number;
    team: string | null;
}

const SurgicalReports = () => {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(6);
    const [reports, setReports] = useState<BatchReport[]>([
        {
            batchId: '270325-BC001M',
            date: '12 September 2023',
            location: 'Hyderabad',
            dogsCaptured: 80,
            team: 'Team D'
        },
        {
            batchId: '270325-BC001M',
            date: '12 September 2023',
            location: 'Hyderabad',
            dogsCaptured: 80,
            team: null
        },
        {
            batchId: '270325-BC001M',
            date: '12 September 2023',
            location: 'Hyderabad',
            dogsCaptured: 80,
            team: null
        },
        {
            batchId: '270325-BC001M',
            date: '12 September 2023',
            location: 'Hyderabad',
            dogsCaptured: 80,
            team: null
        },
        {
            batchId: '270325-BC001M',
            date: '12 September 2023',
            location: 'Hyderabad',
            dogsCaptured: 80,
            team: null
        }
    ]);

    const paginationRange = [6, 7, 8, 9, 10];

    const handleViewClick = (batchId: string) => {
        router.push(`/surgical_reports/view/${batchId}`);
    };

    const assignTeam = (index: number, team: string | null) => {
        const updatedReports = [...reports];
        if (updatedReports[index]) {
            updatedReports[index].team = team;
            setReports(updatedReports);
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-xl font-semibold text-blue-600">Hello Admin</h1>
                <div className="relative w-1/3">
                    <div className="relative">
                        <Input
                            type="text"
                            placeholder="Search Employee, Doctor, Dog ID"
                            className="pr-10 border-b border-t-0 border-x-0 rounded-none focus:ring-0 pl-0"
                        />
                        <Search className="absolute right-3 top-2.5 text-blue-500" size={20} />
                    </div>
                </div>
            </div>

            {/* Title Section */}
            <div className="mb-6">
                <h2 className="text-xl font-bold">Surgical reports</h2>
                <p className="text-sm text-gray-600">Surgical team assignments</p>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-lg p-6 mb-6 border border-gray-300">
                <h3 className="text-sm font-semibold mb-4">Filters</h3>
                <p className="text-xs text-gray-500 mb-4">Filter by date and batch</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm mb-2">Date</label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                            className="w-full bg-gray-100"
                            placeholder="April 18th, 2023"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">Batch</label>
                        <Select defaultValue="all">
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All vehicles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All vehicles</SelectItem>
                                <SelectItem value="vehicle-a">Vehicle A</SelectItem>
                                <SelectItem value="vehicle-b">Vehicle B</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-300">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-sm font-semibold">Surgical Report - Batches List</h3>
                        <p className="text-xs text-gray-500">Report of Dog captures</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="border-gray-300 text-gray-700"
                        >
                            Save changes
                        </Button>
                        <Button
                            variant="default"
                            className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-white"
                            >
                                <path
                                    d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M7 10L12 15L17 10"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M12 15V3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            Download
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="w-8 py-2 px-4"><Checkbox /></th>
                                <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">BATCH ID</th>
                                <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">CAPTURE DATE</th>
                                <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">DOGS LOCATION</th>
                                <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">DOGS CAPTURED</th>
                                <th className="text-center py-2 px-4 text-gray-500 font-medium text-xs">TEAM</th>
                                <th className="text-center py-2 px-4 text-gray-500 font-medium text-xs">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report, index) => (
                                <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                    <td className="py-3 px-4"><Checkbox /></td>
                                    <td className="py-3 px-4 text-sm">{report.batchId}</td>
                                    <td className="py-3 px-4 text-sm">{report.date}</td>
                                    <td className="py-3 px-4 text-sm">{report.location}</td>
                                    <td className="py-3 px-4 text-sm">{report.dogsCaptured}</td>
                                    <td className="py-3 px-4 text-center">
                                        <Select
                                            value={report.team || 'none'}
                                            onValueChange={(value) => assignTeam(index, value === 'none' ? null : value)}
                                        >
                                            <SelectTrigger className="w-32 h-9 py-1 rounded-full text-sm">
                                                <SelectValue placeholder="Assign Team" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Assign Team</SelectItem>
                                                <SelectItem value="Team A">Team A</SelectItem>
                                                <SelectItem value="Team B">Team B</SelectItem>
                                                <SelectItem value="Team C">Team C</SelectItem>
                                                <SelectItem value="Team D">Team D</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <Button
                                            variant="ghost"
                                            className="text-gray-600 hover:text-gray-900 text-sm h-auto py-1"
                                            onClick={() => handleViewClick(report.batchId)}
                                        >
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center space-x-2 mt-6">
                    <button className="p-2 rounded-lg hover:bg-gray-100">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    {paginationRange.map((page) => (
                        <button
                            key={page}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg ${currentPage === page
                                    ? 'bg-gray-200 text-gray-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            onClick={() => setCurrentPage(page)}
                        >
                            {page}
                        </button>
                    ))}
                    <button className="p-2 rounded-lg hover:bg-gray-100">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurgicalReports;