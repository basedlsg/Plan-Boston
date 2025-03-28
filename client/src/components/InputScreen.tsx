import React, { useState, useEffect } from 'react';
import Logo from './Logo';

interface InputScreenProps {
  onSubmit: (data: { date: string; time: string; plans: string }) => void;
  isLoading?: boolean;
}

const InputScreen: React.FC<InputScreenProps> = ({ onSubmit, isLoading }) => {
  // Initialize with current date and time
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [time, setTime] = useState(formatTimeForInput(new Date()));
  const [plans, setPlans] = useState('');

  // Format date for date input (YYYY-MM-DD)
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format time for time input (HH:MM)
  function formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Set current date and time when component mounts
  useEffect(() => {
    const now = new Date();
    setDate(formatDateForInput(now));
    setTime(formatTimeForInput(now));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ date, time, plans });
  };

  // Mobile-first design based on the mockup
  return (
    <div className="bg-white flex flex-col items-center min-h-screen w-full" style={{
      fontFamily: "'Poppins', sans-serif"
    }}>
      <div className="w-full max-w-md px-4 py-6 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-4">
          <Logo className="w-24 h-24" />
        </div>
        
        {/* Instruction Text */}
        <p className="text-center mb-6 text-lg" style={{ color: '#17B9E6' }}>
          Enter your activities, locations and<br />
          times below, we'll create a day plan for you.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full">
          {/* Date Field */}
          <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label 
              htmlFor="date"
              className="block mb-1 font-semibold text-gray-700"
            >
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-gray-700 focus:outline-none text-lg pl-3"
              required
            />
          </div>

          {/* Time Field */}
          <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label
              htmlFor="time"
              className="block mb-1 font-semibold text-gray-700"
            >
              Time
            </label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-transparent text-gray-700 focus:outline-none text-lg pl-3"
              required
            />
          </div>

          {/* Plans Field */}
          <div className="mb-8 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label
              htmlFor="plans"
              className="block mb-1 font-semibold text-gray-700"
            >
              Your Plans
            </label>
            <textarea
              id="plans"
              value={plans}
              onChange={(e) => setPlans(e.target.value)}
              className="w-full bg-transparent text-gray-700 focus:outline-none text-lg min-h-[100px] p-3"
              placeholder="e.g. 12pm lunch in Mayfair, then grab a coffee and have a walk"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl"
            style={{
              background: '#17B9E6',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.8 : 1,
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="loading-indicator" style={{ 
                  width: 20, 
                  height: 20,
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Creating Plan...</span>
              </div>
            ) : (
              'Create Plan'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputScreen; 