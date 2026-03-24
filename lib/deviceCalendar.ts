import * as Calendar from 'expo-calendar';

export async function addTaskToDeviceCalendar(params: {
  title: string;
  dueDate: string;
  notes?: string | null;
}) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Calendar permission was not granted.');
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT
  );

  const writableCalendar =
    calendars.find((calendar) => calendar.allowsModifications) ?? calendars[0];

  if (!writableCalendar) {
    throw new Error('No writable calendar was found on this device.');
  }

  const startDate = new Date(`${params.dueDate}T09:00:00`);
  const endDate = new Date(`${params.dueDate}T10:00:00`);

  const eventId = await Calendar.createEventAsync(writableCalendar.id, {
    title: params.title,
    notes: params.notes ?? '',
    startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return eventId;
}