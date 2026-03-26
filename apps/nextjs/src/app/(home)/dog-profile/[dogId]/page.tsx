'use client';

import { useRouter } from 'next/navigation';
import { Edit, MapPin, ChevronLeft, Search, Minus, Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';

interface PageProps {
  params: {
    dogId: string;
  }
}

export default function DogProfilePage({ params }: PageProps) {
  const router = useRouter();
  const { dogId } = params;
  
  // Mock dog data
  const dogData = {
    id: dogId || '270325-BC001M',
    name: 'Border Collie',
    gender: 'Male',
    captureDate: '27th March 2025',
    releaseDate: '30th March 2025',
    location: 'Jubilee Hills',
    photo: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=300&q=80',
    doctorName: 'Esther Howard',
    doctorEmail: 'esther.howard@gmail.com',
    doctorPhoto: 'https://randomuser.me/api/portraits/women/44.jpg',
    captureLocation: {
      name: 'Jubilee Hills',
      date: 'March 27th, 2025',
      time: '09:30',
      distance: '2,5',
      duration: '28:20'
    }
  };
  
  const handleBackToList = () => {
    router.back();
  };

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-lg font-semibold text-blue-600">Hello Admin</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Employee, Doctor, Dog ID"
              className="w-[360px] border-0 border-b-2 border-blue-500/20 focus:border-blue-500 pl-0 pr-10 py-2 outline-none text-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <Search size={18} className="text-blue-500" />
            </div>
          </div>
          <Button 
            className="bg-white border border-blue-500 text-blue-500 hover:bg-blue-50 h-9 px-4 py-0 rounded-full text-sm font-medium"
          >
            <Plus size={16} className="mr-1.5 text-blue-500" />
            Create Capture
          </Button>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-700 mb-8">Dog Profile</h2>

      {/* Profile and Map section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - Dog Profile and Details */}
        <div className="lg:col-span-1">
          {/* Dog Profile Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md mr-5">
                <img
                  src={dogData.photo}
                  alt="Dog"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <div className="text-gray-600 font-medium">{dogData.id}</div>
                  <button className="ml-2 text-blue-500 bg-blue-50 rounded-md p-1">
                    <Edit size={14} />
                  </button>
                </div>
                <div className="text-gray-600 mb-1">Dog · {dogData.name}</div>
                <div className="text-blue-500 flex items-center">
                  <span className="font-medium">Male</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
                    <path d="M12 15C15.3137 15 18 12.3137 18 9C18 5.68629 15.3137 3 12 3C8.68629 3 6 5.68629 6 9C6 12.3137 8.68629 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-4">Important dates</h3>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
                    <path d="M12 19V12M12 12V5M12 12H5M12 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Capture</div>
                </div>
                <div className="text-sm">{dogData.captureDate}</div>
              </div>

              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500" style={{ transform: "rotate(45deg)" }}>
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Release</div>
                </div>
                <div className="text-sm">{dogData.releaseDate}</div>
              </div>
            </div>
          </div>

          {/* Doctor Assigned */}
          <div className="mb-6 border-b pb-6">
            <h3 className="text-sm font-semibold mb-4">Doctor assigned</h3>
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full overflow-hidden mr-3">
                <img
                  src={dogData.doctorPhoto}
                  alt="Doctor"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-sm font-medium">{dogData.doctorName}</div>
                <div className="text-xs text-gray-500">{dogData.doctorEmail}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Map Component */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <MapPin size={18} className="text-green-500" />
                </div>
                <div className="text-sm font-medium flex-1">Drop off location</div>
                <button className="text-gray-400 hover:text-gray-600">
                  <Minus size={20} />
                </button>
              </div>
            </div>
            
            <div className="relative h-60 lg:h-[380px] bg-gray-100">
              {/* Map placeholder */}
              <div className="absolute inset-0 bg-gray-200">
                <img 
                  src="https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+1a73e8(78.4867,17.4123)/78.4867,17.4123,13,0/600x380?access_token=pk.placeholder" 
                  alt="Map"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://placehold.co/600x380?text=Map+of+Jubilee+Hills';
                  }}
                />
                
                {/* Marker in center of map */}
                <div className="absolute top-[46%] left-[50%] transform -translate-x-1/2 -translate-y-1/2">
                  <div className="h-8 w-8 rounded-full bg-white p-1 shadow-md">
                    <div className="h-full w-full rounded-full overflow-hidden">
                      <img 
                        src={dogData.photo} 
                        alt="Dog location" 
                        className="h-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-2 h-2 bg-white rotate-45 shadow-md"></div>
                </div>
              </div>
              
              {/* Map controls */}
              <div className="absolute top-3 right-3">
                <button className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center">
                  <Minus size={16} />
                </button>
              </div>
              
              {/* Location info card */}
              <div className="absolute left-3 bottom-3 right-3 bg-white rounded-lg shadow-md p-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                    <img
                      src={dogData.photo}
                      alt="Dog"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                      {dogData.captureLocation.date} · {dogData.captureLocation.time}
                    </div>
                    <div className="flex items-center">
                      <MapPin size={12} className="text-gray-400 mr-1" />
                      <span className="text-sm">{dogData.captureLocation.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{dogData.captureLocation.distance} <span className="text-xs font-normal">km</span></div>
                    <div className="text-xs text-gray-500">{dogData.captureLocation.duration} <span className="text-[10px]">min</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to List Button - Centered across full width */}
      <div className="flex justify-center mt-8 mb-8">
        <Button 
          onClick={handleBackToList}
          className="w-1/3 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full text-sm font-medium"
        >
          Back to list
        </Button>
      </div>

      {/* Pagination dots */}
      {/* <div className="flex justify-center items-center gap-1 mt-6">
        <div className="w-8 h-1.5 rounded-full bg-amber-400"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
      </div> */}
    </div>
  );
} 