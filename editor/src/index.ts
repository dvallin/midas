import bodyParser from 'body-parser'
import express from 'express'
import { ecsBaseMiddleware } from 'ecs-core'
import { pipeline } from 'middleware-core'
import {
  todoListComponents,
  todoListStorageMiddleware,
  todoListViewsMiddleware,
} from './todo-list/todo-list-context'
import { register as registerTodoListController } from './todo-list/todo-list-controller'

async function run() {
  const context = await pipeline()
    .use(
      ecsBaseMiddleware('todo-mvc-cluster', {
        ...todoListComponents,
      }),
    )
    .use(todoListStorageMiddleware())
    .use(todoListViewsMiddleware())
    .run({})

  const app = express()
  app.set('view engine', 'pug')
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(express.static('editor/assets'))

  registerTodoListController(app, context)

  const PORT = process.env.PORT || 3000
  app.listen(PORT)
}

run()
