'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const DogProfilePage = () => {
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-xl shadow-sm p-6 max-w-6xl mx-auto">
                {/* Header section */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-xl font-medium text-teal-600">Hello Admin</h1>

                    <div className="flex items-center gap-4">
                        {/* Search Bar */}
                        <div className="relative" style={{ width: '530px', height: '41.19px' }}>
                            <input
                                type="text"
                                placeholder="Search Employee, Doctor, Dog ID"
                                className="w-full h-full pl-4 pr-10 bg-transparent border-0 border-b-2 border-[#81D0DF] focus:outline-none focus:ring-0 text-black"
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Image
                                    src="/assets/images/search.png"
                                    alt="Search"
                                    width={24}
                                    height={24}
                                />
                            </div>
                        </div>

                        {/* Create Capture Button */}
                    <button className="flex items-center gap-2 bg-teal-500 px-4 py-2 rounded-md">
                    <span className="text-lg font-bold text-white">+</span>
                    <span>Create Capture</span>
                    </button>
                    </div>
                </div>

                {/* Content section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left column - Dog info - Card with width 390px */}
                    <div className="bg-white rounded-lg p-4 shadow-sm" style={{ width: '390px' }}>
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Dog Profile</h2>

                        <div className="flex flex-col items-center mb-6">
                            <div className="relative mb-4">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md">
                                    <img
                                        src="/assets/images/dog2.png"
                                        alt="Dog"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">270325-BC001M</span>
                                <button className="text-blue-500">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </div>

                            <div className="text-sm text-gray-600 mb-1">Dog · Border Collie</div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                                Male
                                <Image
                                    src="/assets/images/bomb.png"
                                    alt="Male"
                                    width={16}
                                    height={16}
                                />
                            </div>
                        </div>

                        {/* Important dates - 390px width, 176px height */}
                        <div className="mb-6" style={{ width: '390px', height: '176px' }}>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Important dates</h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                <div className="flex items-center">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3">
                                        <Image
                                            src="/assets/images/downarrow.png"
                                            alt="Capture"
                                            width={36}
                                            height={34}
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-medium">Capture</span>
                                        <span className="block text-sm text-gray-500">27th March 2025</span>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3">
                                        <Image
                                            src="/assets/images/uparrow.png"
                                            alt="Release"
                                            width={36}
                                            height={34}
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-medium">Release</span>
                                        <span className="block text-sm text-gray-500">30th March 2025</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Doctor assigned */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Doctor assigned</h3>
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                                    <Image
                                        src="/assets/images/Avatar.png"
                                        alt="Doctor"
                                        width={40}
                                        height={40}
                                    />
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-black">Esther Howard</span>
                                    <span className="block text-xs text-gray-500">esther.howard@gmail.com</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column - Map - Card with dimensions 630px width, 550px height */}
                    <div className="md:col-span-2 bg-white rounded-lg p-4 shadow-sm" style={{ width: '630px', height: '550px' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div style={{ width: '60px', height: '60px', borderRadius: '10px', border: '1.5px solid #E5E7EB' }} className="flex items-center justify-center">
                                    <Image
                                        src="/assets/images/location.png"
                                        alt="Location"
                                        width={60}
                                        height={60}
                                    />
                                </div>
                                <span className="text-base font-medium text-black">Drop off location</span>
                            </div>
                            <button className="text-gray-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Map image - with increased width */}
                        <div className="relative mb-4" style={{ width: '100%', height: '410px' }}>
                            <Image
                                src="/assets/images/mapp.png"
                                alt="Map"
                                layout="fill"
                                objectFit="cover"
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Back button with exact dimensions */}
                <div className="flex justify-center mt-8">
                    <Link href="/capture-list" passHref>
                        <button
                            className="bg-[#1B85F3] text-white font-medium hover:bg-blue-600 transition"
                            style={{
                                width: '480px',
                                height: '54px',
                                padding: '17px',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Back to list
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DogProfilePage;