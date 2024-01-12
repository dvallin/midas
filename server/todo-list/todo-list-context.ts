import { component, ComponentConfig } from '../../src/ecs'
import { InMemoryArrayStorage } from '../../src/ecs/component'
import { ContextExtensionMiddleware } from '../../src/middleware'
import { lens, mutate } from '../../src/middleware/mutable-context'
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
    todoList: component.ArrayStorage<Todo>
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
      todoList: Omit<ComponentConfig, 'type' | 'schema'> & {
        type: 'array'
        schema: typeof TodoSchema
      }
    }
  },
>(): ContextExtensionMiddleware<C, TodoListStorageContext> => {
  return async (_e, ctx, next) => {
    console.log('build todo storage context')
    const nextContext = lens(
      ctx,
      'storages',
      (storages) =>
        mutate(storages, 'todoList', new InMemoryArrayStorage<Todo>()),
    )
    return await next(nextContext)
  }
}

export const todoListViewsMiddleware = <C>(): ContextExtensionMiddleware<
  C,
  TodoListViewContext
> => {
  return async (_e, ctx, next) => {
    const nextContext = lens(
      ctx,
      'views',
      (storages) =>
        mutate(storages, 'todoList', {
          indexTemplate: pug.compileFile('views/index.pug'),
          editItemTemplate: pug.compileFile('views/includes/edit-item.pug'),
          itemCountTemplate: pug.compileFile('views/includes/item-count.pug'),
          todoItemTemplate: pug.compileFile('views/includes/todo-item.pug'),
          todoListTemplate: pug.compileFile('views/includes/todo-list.pug'),
        }),
    )
    return await next(nextContext)
  }
}
