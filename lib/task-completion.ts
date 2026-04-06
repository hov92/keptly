import { supabase } from './supabase';

type CompleteTaskParams = {
  taskId: string;
  isCompleted: boolean;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
};

export async function completeTaskSmart(params: CompleteTaskParams) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? null;

  if (params.isCompleted) {
    const { error } = await supabase
      .from('tasks')
      .update({
        is_completed: false,
        completed_at: null,
        completed_by: null,
      })
      .eq('id', params.taskId);

    if (error) {
      throw new Error(error.message);
    }

    return { newTaskId: null };
  }

  if (params.recurrence) {
    const { data, error } = await supabase.rpc('complete_task_with_recurrence', {
      p_task_id: params.taskId,
      p_completed_by: userId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { newTaskId: data ?? null };
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq('id', params.taskId);

  if (error) {
    throw new Error(error.message);
  }

  return { newTaskId: null };
}