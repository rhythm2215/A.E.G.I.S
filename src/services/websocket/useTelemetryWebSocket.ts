import { useEffect, useRef } from 'react';
import { useDroneStore } from '@/store/droneStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useSuspectStore } from '@/store/suspectStore';
import { useIdentityStore } from '@/store/identityStore';
import { mockTimelineEvents } from '@/services/mock/mockData';
import { wsUrl } from '@/lib/apiConfig';
import type { Notification, TimelineEvent } from '@/types';

export function useTelemetryWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const updateDroneTelemetry = useDroneStore((s) => s.updateDroneTelemetry);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const fetchSuspects = useSuspectStore((s) => s.fetchSuspects);
  const fetchWatchlist = useIdentityStore((s) => s.fetchWatchlist);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      try {
        const targetWsUrl = wsUrl('/telemetry');
        const ws = new WebSocket(targetWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('📡 [AEGIS] WebSocket connected to FastAPI telemetry broker.');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // ── Real-time Drone GPS & Telemetry Stream ───────────────────────────────
            if (data.type === 'TELEMETRY_UPDATE' && data.drone) {
              updateDroneTelemetry(data.drone.id || 'DRN-03', {
                coordinates: data.drone.coordinates,
                telemetry: {
                  ...data.drone.telemetry,
                  gpsStatus: 'fixed',
                  altitude: data.drone.coordinates?.altitude || 85,
                },
              });
            }

            // ── Suspect Registered / Deleted / Reset → re-sync watchlist panel immediately ────────────
            if (
              data.event === 'SUSPECT_REGISTERED' ||
              data.type === 'SUSPECT_REGISTERED' ||
              data.event === 'SUSPECT_DELETED' ||
              data.type === 'SUSPECT_DELETED' ||
              data.event === 'SUSPECT_RESET' ||
              data.type === 'SUSPECT_RESET'
            ) {
              fetchSuspects();
              fetchWatchlist();
            }

            // ── Watchlist Suspect Match (RED BOX → CRITICAL Alert) ──────────────────
            if (data.event === 'TARGET_MATCH' || data.type === 'TARGET_MATCH') {
              const suspectId = data.suspectId || 'UNKNOWN';
              const confidence = Math.round((data.confidence || 0.94) * 100);
              const camId = data.droneId || 'CAM-01';

              const newAlert: Notification = {
                id: `NTF-AI-${Date.now()}`,
                priority: 'critical',
                type: 'suspect_detection',
                title: `WATCHLIST MATCH: ${suspectId} (${confidence}%)`,
                message: `${camId} identified ${data.fullName || suspectId} with ${confidence}% biometric confidence in ${data.sector || 'Sector Alpha'}.`,
                timestamp: data.timestamp || new Date().toISOString(),
                read: false,
                acknowledged: false,
                droneId: camId,
                suspectId: suspectId,
                actions: [
                  { label: 'View Profile', action: 'navigate_suspect', variant: 'primary' },
                  { label: 'Dispatch Unit', action: 'dispatch_drone', variant: 'ghost' },
                ],
              };
              addNotification(newAlert);

              const timelineEvt: TimelineEvent = {
                id: `TLE-${Date.now()}`,
                timestamp: data.timestamp || new Date().toISOString(),
                type: 'Watchlist Face Match',
                droneId: camId,
                suspectId: suspectId,
                description: `${data.fullName || suspectId} identified with ${confidence}% confidence`,
                confidence: confidence,
                coordinates: { lat: 25.3176, lng: 82.9739 },
                locationName: `${camId} Sector Alpha`,
                alertStatus: 'CRITICAL',
              };
              mockTimelineEvents.unshift(timelineEvt);
            }

            // ── Authorized Personnel Detected (BLUE BOX → LOW Alert) ────────────────
            if (data.event === 'AUTHORIZED_PERSONNEL' || data.type === 'AUTHORIZED_PERSONNEL') {
              const confidence = Math.round((data.confidence || 0.96) * 100);
              const camId = data.droneId || 'CAM-01';

              const newAlert: Notification = {
                id: `NTF-AUTH-${Date.now()}`,
                priority: 'low',
                type: 'authorized_personnel',
                title: 'AUTHORIZED PERSONNEL VERIFIED',
                message: `${data.fullName || data.personId || 'Officer'} authenticated by ${camId} with ${confidence}% confidence.`,
                timestamp: data.timestamp || new Date().toISOString(),
                read: false,
                acknowledged: false,
                droneId: camId,
                actions: [],
              };
              addNotification(newAlert);
            }

            // ── Unknown Person Detected (ORANGE BOX → MEDIUM Alert) ─────────────────
            // Backend fires: event="UNKNOWN_DETECTION" / type="UNKNOWN_DETECTION"
            // (NOT "UNKNOWN_PERSON" — that was the old incorrect type)
            if (
              data.event === 'UNKNOWN_DETECTION' ||
              data.type === 'UNKNOWN_DETECTION' ||
              data.event === 'UNKNOWN_PERSON' ||
              data.type === 'UNKNOWN_PERSON'
            ) {
              const camId = data.droneId || 'CAM-01';
              const now = new Date();
              const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

              const newAlert: Notification = {
                id: `NTF-UNK-${Date.now()}`,
                priority: 'medium',
                type: 'unknown_person',
                title: 'UNKNOWN INDIVIDUAL DETECTED',
                message: `Unknown person detected by ${camId}. Face not found in Personnel Database or Watchlist Database. Time: ${timeStr}`,
                timestamp: data.timestamp || now.toISOString(),
                read: false,
                acknowledged: false,
                droneId: camId,
                actions: [
                  { label: 'Enroll Identity', action: 'enroll_suspect', variant: 'primary' },
                ],
              };
              addNotification(newAlert);

              const timelineEvt: TimelineEvent = {
                id: `TLE-${Date.now()}`,
                timestamp: data.timestamp || now.toISOString(),
                type: 'Unknown Person Sighted',
                droneId: camId,
                description: 'Unregistered person detected — not in Personnel or Watchlist DB.',
                confidence: 0,
                coordinates: { lat: 25.3184, lng: 82.9752 },
                locationName: `${camId} Surveillance`,
                alertStatus: 'MEDIUM',
              };
              mockTimelineEvents.unshift(timelineEvt);
            }
          } catch (err) {
            console.error('[AEGIS WS] Message parse error:', err);
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [updateDroneTelemetry, addNotification, fetchSuspects, fetchWatchlist]);
}
