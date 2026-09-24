import React, { useState, useEffect } from 'react';
import { DeviceRole, Classroom } from './types';
import { SetupPage } from './components/SetupPage';
import { ClassroomReceiver } from './components/ClassroomReceiver';
import { PrincipalTransmitter } from './components/PrincipalTransmitter';
import { ServerDashboard } from './components/ServerDashboard';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  // Load persistent role from localStorage
  const [role, setRole] = useState<DeviceRole>(() => {
    const savedRole = localStorage.getItem('pa_device_role');
    if (
      savedRole === 'receiver' ||
      savedRole === 'principal' ||
      savedRole === 'server'
    ) {
      return savedRole as DeviceRole;
    }
    return 'setup';
  });

  const [classroom, setClassroom] = useState<Classroom | null>(() => {
    const savedClassroom = localStorage.getItem('pa_classroom_data');
    if (savedClassroom) {
      try {
        return JSON.parse(savedClassroom);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [transmitterName, setTransmitterName] = useState<string>(() => {
    return (
      localStorage.getItem('pa_transmitter_name') || 'Principal Miller (Mobile)'
    );
  });

  const [serverHost, setServerHost] = useState<string>(() => {
    return localStorage.getItem('pa_server_host') || window.location.host;
  });

  // Handle role configuration from the Setup wizard
  const handleConfigureRole = (
    newRole: DeviceRole,
    details?: {
      classroom?: Partial<Classroom>;
      serverHost?: string;
      transmitterName?: string;
    }
  ) => {
    if (details?.serverHost) {
      setServerHost(details.serverHost);
      localStorage.setItem('pa_server_host', details.serverHost);
    }

    if (newRole === 'receiver' && details?.classroom) {
      const fullClassroom: Classroom = {
        id: details.classroom.id || `room-${details.classroom.roomNumber || '101'}`,
        name: details.classroom.name || `Classroom ${details.classroom.roomNumber}`,
        roomNumber: details.classroom.roomNumber || '101',
        grade: details.classroom.grade || 'General',
        wing: details.classroom.wing || 'North Wing',
        volume: details.classroom.volume ?? 85,
        isOnline: true,
        lastPing: Date.now(),
        currentStatus: 'idle',
        panelModel: details.classroom.panelModel || 'Android IFB 75" Touch Panel',
      };

      setClassroom(fullClassroom);
      localStorage.setItem('pa_classroom_data', JSON.stringify(fullClassroom));
      localStorage.setItem('pa_device_role', 'receiver');
      setRole('receiver');
    } else if (newRole === 'principal') {
      const name = details?.transmitterName || 'Principal Miller (Mobile)';
      setTransmitterName(name);
      localStorage.setItem('pa_transmitter_name', name);
      localStorage.setItem('pa_device_role', 'principal');
      setRole('principal');
    } else if (newRole === 'server') {
      localStorage.setItem('pa_device_role', 'server');
      setRole('server');
    } else {
      localStorage.removeItem('pa_device_role');
      setRole('setup');
    }
  };

  const handleExitReceiverMode = () => {
    // Only reachable when Admin PIN 8888 is correctly entered in AdminPinModal
    localStorage.removeItem('pa_device_role');
    setRole('setup');
  };

  const handleExitTransmitterMode = () => {
    localStorage.removeItem('pa_device_role');
    setRole('setup');
  };

  const handleExitServerMode = () => {
    localStorage.removeItem('pa_device_role');
    setRole('setup');
  };

  const handleUpdateClassroom = (updated: Partial<Classroom>) => {
    setClassroom((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('pa_classroom_data', JSON.stringify(next));
      return next;
    });
  };

  const renderContent = () => {
    // Render appropriate view based on configured device role
    if (role === 'receiver' && classroom) {
      return (
        <ClassroomReceiver
          classroom={classroom}
          onExitReceiverMode={handleExitReceiverMode}
          onUpdateClassroom={handleUpdateClassroom}
        />
      );
    }

    if (role === 'principal') {
      return (
        <PrincipalTransmitter
          transmitterName={transmitterName}
          onExitTransmitterMode={handleExitTransmitterMode}
        />
      );
    }

    if (role === 'server') {
      return <ServerDashboard onExitServerMode={handleExitServerMode} />;
    }

    // Default: Clean, Professional Setup Wizard
    return (
      <SetupPage
        onConfigureRole={handleConfigureRole}
        initialServerHost={serverHost}
      />
    );
  };

  return <ThemeProvider>{renderContent()}</ThemeProvider>;
}
