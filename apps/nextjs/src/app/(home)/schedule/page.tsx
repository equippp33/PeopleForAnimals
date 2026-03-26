"use client";

import { useState } from "react";
import Image from "next/image";

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 3, 15)); // April 15, 2025
  const [currentMonth, setCurrentMonth] = useState(3); // April (0-indexed)
  const [currentYear, setCurrentYear] = useState(2025);

  // Calendar data
  const daysOfWeek = ["Mo", "Tu", "W", "Th", "Fr", "Sa", "Su"];

  // Format date as string
  const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Handle month navigation
  const navigateMonth = (direction: 'prev' | 'next'): void => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  // Generate calendar days for the current month/year
  const getDays = () => {
    const days = [];
    const year = currentYear;
    const month = currentMonth;

    // Calculate days in month and first day of month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay() || 7; // Convert Sunday (0) to 7 for proper alignment

    // Add padding for days before the 1st
    for (let i = 1; i < firstDayOfMonth; i++) {
      days.push({ day: null, date: null });
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, date: new Date(year, month, i) });
    }

    return days;
  };

  const calendarDays = getDays();

  // Handle date selection
  const handleDateSelect = (date: Date | null): void => {
    if (date) {
      setSelectedDate(date);
    }
  };

  // Get month name
  const getMonthName = (month: number): string => {
    const date = new Date(currentYear, month, 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  return (
    <div className="flex flex-col space-y-4 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl font-medium text-[#0D47A1] mb-2 sm:mb-0">Hello Admin</h1>
        </div>
        <div className="relative w-full max-w-full sm:max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Employee, Doctor, Dog ID"
              className="w-full border-0 border-b border-[#81D0DF] bg-white px-4 py-2 pr-10 text-black focus:outline-none"
            />
            <Image
              src="/assets/images/search.png"
              alt="Search"
              width={20}
              height={20}
              className="absolute right-3 top-1/2 -translate-y-1/2 transform"
            />
          </div>
        </div>
      </div>

      {/* Schedule Section */}
      <div className="mt-4 sm:mt-6 md:mt-8">
        <h2 className="text-xl font-medium text-black">Schedule</h2>
        <p className="text-sm text-black">
          Manage and view schedule of all teams
        </p>
      </div>

      {/* Schedule Content */}
      <div className="mt-4 flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Left Card - Schedule Tasks */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white shadow-sm min-h-[400px] sm:min-h-[432px] overflow-auto">
          <div className="p-4">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center mt-1 sm:mt-0">
                <Image
                  src="/assets/images/cal.png"
                  width={16}
                  height={16}
                  alt="Calendar"
                  className="mr-2"
                />
                <span className="text-sm font-medium text-black">
                  Schedule for{" "}
                  <span className="text-blue-500">
                    {formatDate(selectedDate)}
                  </span>
                </span>
              </div>
              <div className="relative w-full sm:w-auto">
                <select className="w-full sm:w-[160px] appearance-none rounded border border-gray-300 bg-white px-2 py-2 sm:py-1 pr-10 text-sm text-black">
                  <option>All activities</option>
                  <option>Capture tasks</option>
                  <option>Release tasks</option>
                  <option>Surgical tasks</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 1L5 5L9 1"
                      stroke="#6B7280"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <p className="mb-3 text-xs text-black">
              Select a date to view tasks of all teams
            </p>

            {/* Vehicle A - Capture task */}
            <div
              className="relative mt-4 rounded border border-gray-200 min-h-[67px]"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1">
                <Image src="/assets/images/bluebar.png" layout="fill" alt="" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-6 gap-2 sm:gap-4">
                <div>
                  <div className="font-medium text-black">
                    Vehicle A - Capture task
                  </div>
                  <div className="mt-1 text-xs text-black">
                    <span className="mr-1 rounded bg-gray-100 px-1 py-0.5">
                      Team A
                    </span>
                    <span className="text-gray-600">- Operational</span>
                  </div>
                </div>
                <div className="flex items-center mt-1 sm:mt-0">
                  <Image
                    src="/assets/images/smalllocation.png"
                    width={16}
                    height={16}
                    alt="Location"
                    className="mr-1"
                  />
                  <span className="text-sm text-black">Hyderabad</span>
                </div>
              </div>
            </div>

            {/* Vehicle B - Capture task */}
            <div
              className="relative mt-4 rounded border border-gray-200 min-h-[67px]"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1">
                <Image src="/assets/images/bluebar.png" layout="fill" alt="" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-6 gap-2 sm:gap-4">
                <div>
                  <div className="font-medium text-black">
                    Vehicle B - Capture task
                  </div>
                  <div className="mt-1 text-xs text-black">
                    <span className="mr-1 rounded bg-gray-100 px-1 py-0.5">
                      Team A
                    </span>
                    <span className="text-gray-600">- Operational</span>
                  </div>
                </div>
                <div className="flex items-center mt-1 sm:mt-0">
                  <Image
                    src="/assets/images/smalllocation.png"
                    width={16}
                    height={16}
                    alt="Location"
                    className="mr-1"
                  />
                  <span className="text-sm text-black">Lalbaazar</span>
                </div>
              </div>
            </div>

            {/* Batch #1234 - Surgical task */}
            <div
              className="relative mt-4 rounded border border-gray-200 min-h-[67px]"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1">
                <Image src="/assets/images/greybar.png" layout="fill" alt="" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-6 gap-2 sm:gap-4">
                <div>
                  <div className="font-medium text-black">
                    Batch #1234 - Surgical task
                  </div>
                  <div className="mt-1 text-xs text-black">
                    <span className="mr-1 rounded bg-gray-100 px-1 py-0.5">
                      Team A
                    </span>
                    <span className="text-gray-600">- Surgical</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle A - Release task */}
            <div
              className="relative mt-4 rounded border border-gray-200 min-h-[67px]"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1">
                <Image src="/assets/images/greenbar.png" layout="fill" alt="" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-6 gap-2 sm:gap-4">
                <div>
                  <div className="font-medium text-black">
                    Vehicle A - Release task
                  </div>
                  <div className="mt-1 text-xs text-black">
                    <span className="mr-1 rounded bg-gray-100 px-1 py-0.5">
                      Team A
                    </span>
                    <span className="text-gray-600">- Operational</span>
                  </div>
                </div>
                <div className="flex items-center mt-1 sm:mt-0">
                  <Image
                    src="/assets/images/smalllocation.png"
                    width={16}
                    height={16}
                    alt="Location"
                    className="mr-1"
                  />
                  <span className="text-sm text-black">Hyderabad</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card - Calendar */}
        <div className="w-full lg:w-[373px] rounded-lg border border-gray-200 bg-white shadow-sm h-fit mt-4 lg:mt-0">
          <div className="p-4">
            <h3 className="font-medium text-black">Calendar</h3>
            <p className="mb-5 text-xs text-black">
              Select to select specific teams or all teams
            </p>

            {/* Calendar component */}
            <div className="w-full max-w-[321px] mx-auto rounded border border-gray-200 min-h-[300px] sm:min-h-[326px] overflow-hidden">
              <div className="flex items-center justify-between border-b p-3">
                <button 
                  className="text-gray-400" 
                  onClick={() => navigateMonth('prev')}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M15 18l-6-6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="font-medium text-black">
                  {getMonthName(currentMonth)} {currentYear}
                </span>
                <button 
                  className="text-gray-400"
                  onClick={() => navigateMonth('next')}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 p-2 text-center">
                {/* Days of week */}
                {daysOfWeek.map((day, i) => (
                  <div key={i} className="py-2 text-xs font-medium text-black">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((day, i) => {
                  const isSelected = day.date && 
                    day.date.getDate() === selectedDate.getDate() && 
                    day.date.getMonth() === selectedDate.getMonth() && 
                    day.date.getFullYear() === selectedDate.getFullYear();
                  const isCurrentMonth = day.day !== null;

                  return (
                    <div
                      key={i}
                      className={`mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm transition-colors
                        ${isSelected ? "bg-blue-500 text-white" : ""} 
                        ${!isCurrentMonth ? "text-gray-300" : "text-black hover:bg-gray-100 active:bg-gray-200"}`}
                      onClick={() => isCurrentMonth && handleDateSelect(day.date)}
                    >
                      {day.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}