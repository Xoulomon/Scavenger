import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as projectAnnotations from './preview'

// Apply global Storybook annotations (decorators, parameters) to all story tests.
const annotations = setProjectAnnotations([projectAnnotations])

beforeAll(annotations.beforeAll)
