export type DeviceRole = 'setup' | 'principal' | 'receiver' | 'server';

export type AnnouncementType = 'voice' | 'tts' | 'chime' | 'emergency';

export type EmergencyType = 'lockdown' | 'evacuation' | 'severe_weather' | 'medical' | 'all_clear';

export type ChimeType = 'attention' | 'westminster' | 'period_bell' | 'morning' | 'lunch';

export interface Classroom {
  id: string;
  name: string;
  roomNumber: string;
  grade: string;
  wing: string;
  volume: number; // 0 to 100
  isOnline: boolean;
  lastPing: number;
  ipAddress?: string;
  currentStatus: 'idle' | 'playing' | 'emergency';
  panelModel?: string;
  notes?: string;
}

export interface Announcement {
  id: string;
  timestamp: number;
  type: AnnouncementType;
  sender: string;
  title: string;
  message?: string;
  targetType: 'all' | 'rooms' | 'wings';
  targetIds: string[]; // room IDs or wing names
  audioData?: string; // base64 data url for recorded voice or audio
  emergencyType?: EmergencyType;
  chimeType?: ChimeType;
  priority: 'normal' | 'high' | 'emergency';
  duration?: number;
}

export interface ServerInfo {
  status: 'online' | 'degraded';
  serverIp: string;
  port: number;
  hostname: string;
  uptimeSeconds: number;
  activeReceivers: number;
  totalClassrooms: number;
  activeTransmitters: number;
  announcementsCount: number;
}

export interface TransmitterLockConfig {
  lockPassword: string;
  updatedAt: number;
  updatedBy: string;
  requireLockOnIdle?: boolean;
}

export interface BellScheduleItem {
  id: string;
  name: string;
  time: string; // "HH:MM" 24h format e.g. "08:30"
  daysOfWeek: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  chimeType: ChimeType;
  enabled: boolean;
}

export interface BellScheduleConfig {
  enabled: boolean;
  activeProfileName: string;
  items: BellScheduleItem[];
}

export interface WSMessage {
  type: 
    | 'register'
    | 'init'
    | 'heartbeat'
    | 'heartbeat_ack'
    | 'announcement'
    | 'announcement_broadcast'
    | 'announcement_play'
    | 'announcement_ack'
    | 'announcement_dispatched'
    | 'announcement_status'
    | 'announcement_ended'
    | 'classrooms_sync'
    | 'classroom_update'
    | 'classroom_delete'
    | 'ping_test'
    | 'ping_test_received'
    | 'volume_change'
    | 'voice_stream_start'
    | 'voice_stream_chunk'
    | 'voice_stream_end'
    | 'transmitter_lock_update'
    | 'transmitter_lock_sync'
    | 'transmitter_force_lock'
    | 'bell_schedule_sync'
    | 'bell_schedule_trigger'
    | string;
  payload?: any;
}
