import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Container,
  Header,
  Input,
  Message,
  Modal,
} from 'semantic-ui-react'

import * as MessageList from 'components/MessageList'
import * as AccountService from 'services/accounts'
import * as AccountsTable from 'components/Admin/Accounts/AccountsTable'
import * as AccountsTableColumns from 'components/Admin/Accounts/AccountsTableColumns'

import { useBoolean } from 'utils/use-boolean'

const PendingInvites = () => {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState(undefined)
  const [isCreateModalOpen, openCreateModal, closeCreateModal] = useBoolean(
    false,
  )
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useBoolean(
    false,
  )
  const [messages, sendMessage] = MessageList.useMessages()
  const [
    createModalMessages,
    sendCreateModalMessage,
    clearCreateModalMessages,
  ] = MessageList.useMessages()

  const refreshAccounts = () =>
    AccountService.fetchPendingInviteAccounts().then(accounts =>
      setAccounts(accounts),
    )

  // Initial load
  useEffect(() => {
    refreshAccounts().finally(() => setLoading(false))
  }, [])

  const onSelectAccount = useCallback(
    account => setSelectedAccount(account),
    [],
  )

  const onConfirmCreate = useCallback(
    async emailAddress => {
      setLoading(true)
      clearCreateModalMessages()
      try {
        await AccountService.createInviteByEmail(emailAddress)
        closeCreateModal()
        clearCreateModalMessages()
        sendMessage(dismiss => (
          <CreateSuccessMessage emailAddress={emailAddress} dismiss={dismiss} />
        ))
        // Don't need to wait for this
        refreshAccounts().then(() => setLoading(false))
        return true
      } catch (error) {
        sendCreateModalMessage(dismiss => (
          <CreateFailureMessage
            emailAddress={emailAddress}
            dismiss={dismiss}
            errorMessage={error.message}
          />
        ))
        setLoading(false)
        return false
      }
    },
    [
      sendMessage,
      sendCreateModalMessage,
      clearCreateModalMessages,
      closeCreateModal,
    ],
  )

  const onConfirmDelete = useCallback(async () => {
    setLoading(true)
    closeDeleteModal()
    try {
      await AccountService.deleteInviteByIdentityPoolId(
        selectedAccount.identityPoolId,
      )
      sendMessage(dismiss => (
        <DeleteSuccessMessage account={selectedAccount} dismiss={dismiss} />
      ))
      await refreshAccounts()
    } catch (error) {
      sendMessage(dismiss => (
        <DeleteFailureMessage
          account={selectedAccount}
          dismiss={dismiss}
          errorMessage={error.message}
        />
      ))
    } finally {
      setLoading(false)
    }
  }, [sendMessage, selectedAccount, closeDeleteModal])

  return (
    <Container fluid style={{ padding: '2em' }}>
      <Header as='h1'>Pending invites</Header>
      <MessageList.MessageList messages={messages} />
      <AccountsTable.AccountsTable
        accounts={accounts}
        columns={[
          AccountsTableColumns.EmailAddress,
          AccountsTableColumns.DateInvited,
          AccountsTableColumns.Inviter,
        ]}
        loading={loading}
        selectedAccount={selectedAccount}
        onSelectAccount={onSelectAccount}
      >
        <TableActions
          canCreate={!loading}
          onClickCreate={openCreateModal}
          canDelete={!loading && selectedAccount}
          onClickDelete={openDeleteModal}
        />
      </AccountsTable.AccountsTable>
      <CreateInviteModal
        onConfirm={onConfirmCreate}
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        messages={createModalMessages}
      />
      <DeleteInviteModal
        account={selectedAccount}
        onConfirm={onConfirmDelete}
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
      />
    </Container>
  )
}
export default PendingInvites

const TableActions = React.memo(
  ({ canCreate, onClickCreate, canDelete, onClickDelete }) => (
    <Button.Group>
      <Button
        content='Create invite...'
        disabled={!canCreate}
        onClick={onClickCreate}
      />
      <Button content='Delete' disabled={!canDelete} onClick={onClickDelete} />
    </Button.Group>
  ),
)

/*
 * Note: `onConfirm` should return a boolean indicating whether the creation
 * succeeded.
 */
const CreateInviteModal = ({ onConfirm, open, onClose, messages }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const isEmailValid = useMemo(() => /^[^@\s]+@[^@\s]+$/.test(email), [email])
  const onChangeEmailAddress = useCallback(
    (_event, { value }) => setEmail(value),
    [],
  )
  const onClickCreate = useCallback(async () => {
    setLoading(true)
    if (await onConfirm(email)) {
      setEmail('')
    }
    setLoading(false)
  }, [onConfirm, email])

  return (
    <Modal open={open} onClose={onClose} size={'small'}>
      <Modal.Header>Create invite</Modal.Header>
      <Modal.Content>
        <p>
          Enter an email address below and select <strong>Create</strong> to
          send an invitation to create an account.
        </p>
        <MessageList.MessageList messages={messages} />
        <Message hidden={isEmailValid || loading} warning>
          Please enter a valid email address.
        </Message>
        <Input
          placeholder='Email address'
          value={email}
          onChange={onChangeEmailAddress}
          disabled={loading}
          style={{ width: '100%' }}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button disabled={loading} loading={loading} onClick={onClose}>
          Cancel
        </Button>
        <Button
          positive
          disabled={!isEmailValid}
          loading={loading}
          onClick={onClickCreate}
        >
          Create
        </Button>
      </Modal.Actions>
    </Modal>
  )
}

const DeleteInviteModal = React.memo(
  ({ account, onConfirm, open, onClose }) =>
    account && (
      <Modal size='small' open={open} onClose={onClose}>
        <Modal.Header>Confirm invite deletion</Modal.Header>
        <Modal.Content>
          <p>
            Are you sure you want to delete this account invite for{' '}
            <strong>{account.emailAddress}</strong>? This action is
            irreversible.
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={onClose}>Cancel</Button>
          <Button negative onClick={onConfirm}>
            Delete
          </Button>
        </Modal.Actions>
      </Modal>
    ),
)

const CreateSuccessMessage = React.memo(({ emailAddress, dismiss }) => (
  <Message onDismiss={dismiss} positive>
    <Message.Content>
      Sent account invite to <strong>{emailAddress}</strong>.
    </Message.Content>
  </Message>
))

const CreateFailureMessage = React.memo(
  ({ emailAddress, errorMessage, dismiss }) => (
    <Message onDismiss={dismiss} negative>
      <Message.Content>
        <p>
          Failed to send account invite to <strong>{emailAddress}</strong>.
        </p>
        {errorMessage && <p>Error message: {errorMessage}</p>}
      </Message.Content>
    </Message>
  ),
)

const DeleteSuccessMessage = React.memo(({ account, dismiss }) => (
  <Message onDismiss={dismiss} positive>
    <Message.Content>
      Deleted account invite for <strong>{account.emailAddress}</strong>.
    </Message.Content>
  </Message>
))

const DeleteFailureMessage = React.memo(
  ({ account, errorMessage, dismiss }) => (
    <Message onDismiss={dismiss} negative>
      <Message.Content>
        <p>
          Failed to delete account invite for{' '}
          <strong>{account.emailAddress}</strong>.
        </p>
        {errorMessage && <p>Error message: {errorMessage}</p>}
      </Message.Content>
    </Message>
  ),
)
