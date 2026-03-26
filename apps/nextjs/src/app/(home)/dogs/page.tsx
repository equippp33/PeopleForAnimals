'use client';

import { useRouter } from 'next/navigation';
import { Button } from "~/components/ui/button";

interface DogOperation {
  id: string;
  date: string;
  location: string;
  count: number;
  type: 'capture' | 'release';
}

export default function DogsPage() {
  const router = useRouter();

  // Mock data for the table
  const recentOperations: DogOperation[] = [
    {
      id: '270325-BC001M',
      date: '12 September 2023',
      location: 'Jubilee Hills',
      count: 80,
      type: 'capture'
    },
    {
      id: '270325-BC002M',
      date: '12 September 2023',
      location: 'Banjara Hills',
      count: 65,
      type: 'release'
    },
    {
      id: '270325-BC003M',
      date: '11 September 2023',
      location: 'Jubilee Hills',
      count: 45,
      type: 'capture'
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Dog Operations Dashboard</h1>
        <p className="text-gray-600">Manage and view dog capture and release operations</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <Button
          onClick={() => router.push('/operational-reports?tab=capture')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Capture Dogs
        </Button>
        <Button
          onClick={() => router.push('/operational-reports?tab=release')}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Release Dogs
        </Button>
      </div>

      {/* Recent Operations Table */}
      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
        <div className="p-6 border-b border-gray-300">
          <h2 className="text-lg font-semibold">Recent Operations</h2>
          <p className="text-sm text-gray-500">Latest dog capture and release activities</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300">
                <th className="text-left py-4 px-6 text-gray-500 font-medium">BATCH ID</th>
                <th className="text-left py-4 px-6 text-gray-500 font-medium">DATE</th>
                <th className="text-left py-4 px-6 text-gray-500 font-medium">LOCATION</th>
                <th className="text-left py-4 px-6 text-gray-500 font-medium">DOGS COUNT</th>
                <th className="text-left py-4 px-6 text-gray-500 font-medium">TYPE</th>
                <th className="text-left py-4 px-6 text-gray-500 font-medium">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {recentOperations.map((operation) => (
                <tr key={operation.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-4 px-6">{operation.id}</td>
                  <td className="py-4 px-6">{operation.date}</td>
                  <td className="py-4 px-6">{operation.location}</td>
                  <td className="py-4 px-6">{operation.count}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      operation.type === 'capture' 
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {operation.type === 'capture' ? 'Capture' : 'Release'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <Button
                      variant="ghost"
                      onClick={() => router.push(`/operational-reports?tab=${operation.type}`)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      View Details
                    </Button>
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