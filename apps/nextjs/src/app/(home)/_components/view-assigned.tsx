'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface DogRecord {
  id: string;
  date: string;
  gender: string;
  location: string;
  status: 'To be released' | 'Surgery req';
  doctor?: string;
}

const VergeOfSurgeryPage = () => {
  // Sample data for the table
  const [dogRecords, setDogRecords] = useState<DogRecord[]>([
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'To be released' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'Surgery req' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'To be released' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'To be released' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'Surgery req' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'Surgery req' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'To be released' },
    { id: '270325-BC001M', date: '12 September 2023', gender: 'Male', location: 'Jubilee Hills', status: 'To be released' },
  ]);

  // State to track which dropdown is currently open
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);

  // State to track selected records
  const [selectedRecords, setSelectedRecords] = useState<boolean[]>(new Array(8).fill(false));

  // Function to toggle all records selection
  const toggleSelectAll = () => {
    const allSelected = selectedRecords.every(selected => selected);
    setSelectedRecords(new Array(dogRecords.length).fill(!allSelected));
  };

  // Function to toggle individual record selection
  const toggleSelectRecord = (index: number) => {
    const newSelectedRecords = [...selectedRecords];
    newSelectedRecords[index] = !newSelectedRecords[index];
    setSelectedRecords(newSelectedRecords);
  };

  // Function to toggle dropdown
  const toggleDropdown = (index: number) => {
    if (openDropdownIndex === index) {
      setOpenDropdownIndex(null);
    } else {
      setOpenDropdownIndex(index);
    }
  };

  // Function to select a doctor
  const selectDoctor = (doctor: string, index: number) => {
    // Update the record with the selected doctor
    const updatedRecords = [...dogRecords];
    if (updatedRecords[index]) {
      updatedRecords[index].doctor = doctor;
      setDogRecords(updatedRecords);
    }
    setOpenDropdownIndex(null);
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium text-teal-600">Hello Admin</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Employee, Doctor, Dog ID"
              className="pl-10 pr-4 py-2 w-80 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <button className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-md">
            <span className="text-lg font-bold">+</span>
            <span>Create Capture</span>
          </button>
        </div>
      </div>

      {/* Title Section */}
      <h2 className="text-lg font-medium mb-4 text-black">Verge of Surgery - Shankarpalle</h2>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedRecords.every(selected => selected)}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">PHOTO</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">DOG ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">DATE</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">GENDER</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">LOCATION</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">STATUS</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {dogRecords.map((dog, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedRecords[index]}
                    onChange={() => toggleSelectRecord(index)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-orange-200">
                    <img
                      src="/assets/images/dog2.png"
                      alt="Dog"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{dog.id}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{dog.date}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{dog.gender}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{dog.location}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm px-2 py-1 rounded-md ${dog.status === 'To be released'
                        ? 'text-green-600 bg-green-50'
                        : 'text-orange-600 bg-orange-50'
                      }`}
                  >
                    {dog.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(index)}
                        className={`text-sm w-[163px] h-[42px] border border-gray-300 rounded-full flex items-center justify-between px-4 ${dog.doctor ? 'text-blue-500' : 'text-gray-600'
                          }`}
                      >
                        <span>{dog.doctor || 'Assign Doctor'}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdownIndex === index && (
                        <div className="absolute left-0 mt-1 w-[157px] bg-white shadow-lg rounded-[20px] z-10 border border-gray-100">
                          <div className="py-2">
                            <button
                              onClick={() => selectDoctor('Dr. ABC Sharma', index)}
                              className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${dog.doctor === 'Dr. ABC Sharma' ? 'bg-gray-100' : ''}`}
                            >
                              Dr. ABC Sharma
                            </button>
                            <button
                              onClick={() => selectDoctor('Dr. ABC Khan', index)}
                              className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${dog.doctor === 'Dr. ABC Khan' ? 'bg-gray-100' : ''}`}
                            >
                              Dr. ABC Khan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <Link href="/map">
                      <button className="w-16 px-3 py-1 text-sm text-gray-600">View</button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VergeOfSurgeryPage;