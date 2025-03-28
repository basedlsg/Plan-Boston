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

  return (
    <div className="input-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem',
      maxWidth: '800px',
      margin: '2rem auto',
      position: 'relative',
      minHeight: 'calc(100vh - 4rem)'
    }}>
      <Logo className="mb-8" />
      
      <div className="form-container" style={{
        background: 'linear-gradient(135deg, rgba(23, 185, 230, 0.05), rgba(252, 148, 197, 0.08))',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        borderRadius: '12px',
        boxShadow: '0 3px 15px rgba(0, 0, 0, 0.03)',
        border: '1px solid rgba(28, 28, 28, 0.1)',
        padding: '2rem',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <p className="instruction-text" style={{
          fontFamily: "'Poppins', sans-serif",
          color: 'var(--brand-black)',
          textAlign: 'center',
          marginBottom: '2rem',
          fontSize: '1.1rem',
          fontWeight: 600
        }}>
          Enter your activities, locations and times below, we'll create a London day plan for you.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="date"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.5rem',
                color: 'var(--brand-black)'
              }}
            >
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-box"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '1px solid rgba(23, 185, 230, 0.1)',
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)'
              }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="time"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.5rem',
                color: 'var(--brand-black)'
              }}
            >
              Time
            </label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-box"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '1px solid rgba(23, 185, 230, 0.1)',
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)'
              }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label
              htmlFor="plans"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.5rem',
                color: 'var(--brand-black)'
              }}
            >
              Your Plans
            </label>
            <textarea
              id="plans"
              value={plans}
              onChange={(e) => setPlans(e.target.value)}
              className="input-box"
              style={{
                width: '100%',
                minHeight: '120px',
                resize: 'vertical',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '1px solid rgba(23, 185, 230, 0.1)',
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)'
              }}
              placeholder="e.g. 12pm lunch in Mayfair, then grab a coffee in Covent Garden and have a walk along the Thames"
              required
            />
          </div>

          <button
            type="submit"
            className="create-plan-btn"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--brand-blue), var(--brand-pink))',
              color: 'white',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.8 : 1,
              transition: 'all 0.3s ease'
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-indicator" style={{ 
                  width: 24, 
                  height: 24,
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Creating Your London Itinerary...</span>
              </>
            ) : (
              'Create London Itinerary'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputScreen; 