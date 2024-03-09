import {
  ArrayStorage,
  ComponentConfig,
  InMemoryArrayStorage,
} from '../../../ecs/ecs-core'
import {
  ContextExtensionMiddleware,
  mutableContext,
} from '../../../middleware/middleware-core'
import { Todo, TodoSchema } from '../model/todo'
import pug from 'pug'

export const todoListComponents = {
  todoList: {
    schema: TodoSchema,
    type: 'array' as const,
    storageConfig: { type: 'memory' as const },
  },
}

export type TodoListContext = TodoListStorageContext & TodoListViewContext

export type TodoListStorageContext = {
  storages: {
    todoList: ArrayStorage<Todo>
  }
}

export type TodoListViewContext = {
  views: {
    todoList: {
      indexTemplate: pug.compileTemplate
      editItemTemplate: pug.compileTemplate
      itemCountTemplate: pug.compileTemplate
      todoItemTemplate: pug.compileTemplate
      todoListTemplate: pug.compileTemplate
    }
  }
}

export const todoListStorageMiddleware = <
  C extends {
    components: {
      todoList:
        & Omit<ComponentConfig<typeof todoListComponents>, 'type' | 'schema'>
        & {
          type: 'array'
          schema: typeof TodoSchema
        }
    }
  },
>(): ContextExtensionMiddleware<C, TodoListStorageContext> => {
  return async (_e, ctx, next) => {
    const nextContext = mutableContext.lens(
      ctx,
      'storages',
      (storages) =>
        mutableContext.mutate(
          storages,
          'todoList',
          new InMemoryArrayStorage<Todo>(),
        ),
    )
    return await next(nextContext)
  }
}

export const todoListViewsMiddleware = <C>(): ContextExtensionMiddleware<
  C,
  TodoListViewContext
> => {
  return async (_e, ctx, next) => {
    const nextContext = mutableContext.lens(
      ctx,
      'views',
      (storages) =>
        mutableContext.mutate(storages, 'todoList', {
          indexTemplate: pug.compileFile('editor/views/index.pug'),
          editItemTemplate: pug.compileFile(
            'editor/views/includes/edit-item.pug',
          ),
          itemCountTemplate: pug.compileFile(
            'editor/views/includes/item-count.pug',
          ),
          todoItemTemplate: pug.compileFile(
            'editor/views/includes/todo-item.pug',
          ),
          todoListTemplate: pug.compileFile(
            'editor/views/includes/todo-list.pug',
          ),
        }),
    )
    return await next(nextContext)
  }
}
