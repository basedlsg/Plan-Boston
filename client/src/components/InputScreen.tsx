import React, { useState } from 'react';
import Logo from './Logo';

interface InputScreenProps {
  onSubmit: (data: { date: string; time: string; plans: string }) => void;
  isLoading?: boolean;
}

const InputScreen: React.FC<InputScreenProps> = ({ onSubmit, isLoading }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [plans, setPlans] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ date, time, plans });
  };

  return (
    <div className="input-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'var(--spacing-xl)',
      maxWidth: '600px',
      margin: '0 auto',
      minHeight: '100vh'
    }}>
      <Logo className="mb-8" />
      
      <p className="instruction-text" style={{
        fontFamily: 'var(--font-button)',
        color: 'var(--color-primary)',
        textAlign: 'center',
        marginBottom: 'var(--spacing-xl)',
        fontSize: '1.1rem'
      }}>
        Enter your activities, locations and times below, we'll create a day plan for you.
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label 
            htmlFor="date"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'bold',
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              color: 'var(--color-text-black)'
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
            style={{ width: '100%' }}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label
            htmlFor="time"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'bold',
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              color: 'var(--color-text-black)'
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
            style={{ width: '100%' }}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <label
            htmlFor="plans"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'bold',
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              color: 'var(--color-text-black)'
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
              resize: 'vertical'
            }}
            placeholder="e.g. 12pm lunch in mayfair, then grab a coffee and have a walk"
            required
          />
        </div>

        <button
          type="submit"
          className="button button-primary"
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="loading-indicator" style={{ width: 24, height: 24 }} />
              <span>Creating Plan...</span>
            </>
          ) : (
            'Create Plan'
          )}
        </button>
      </form>
    </div>
  );
};

export default InputScreen; 