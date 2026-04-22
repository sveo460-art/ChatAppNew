import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Updates from 'expo-updates';

const App = () => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [users, setUsers] = useState([]);
  
  const ws = useRef(null);
  const flatListRef = useRef(null);

  const SERVER_URL = 'ws://157.22.195.202:3000';

  // Проверка обновлений
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('Доступно обновление, загружаю...');
          await Updates.fetchUpdateAsync();
          console.log('Обновление загружено, перезапускаю...');
          await Updates.reloadAsync();
        } else {
          console.log('Нет обновлений');
        }
      } catch (error) {
        console.log('Ошибка проверки обновлений:', error);
      }
    }
    
    checkForUpdates();
  }, []);

  const connectWebSocket = () => {
    ws.current = new WebSocket(SERVER_URL);
    
    ws.current.onopen = () => {
      console.log('Подключено к серверу');
    };
    
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error('Ошибка:', error);
      }
    };
    
    ws.current.onerror = () => {
      Alert.alert('Ошибка', 'Нет подключения к серверу');
      setIsLoading(false);
    };
  };

  const handleMessage = (data) => {
    switch(data.type) {
      case 'auth_success':
        setIsLoading(false);
        if (mode === 'register') {
          Alert.alert('Успех', 'Регистрация завершена. Теперь войдите.');
          setMode('login');
          setPassword('');
        } else {
          setIsAuthenticated(true);
          ws.current.send(JSON.stringify({
            type: 'join',
            username: username,
            room: 'general'
          }));
        }
        break;
        
      case 'auth_error':
        setIsLoading(false);
        Alert.alert('Ошибка', data.error);
        break;
        
      case 'message':
        setMessages(prev => [...prev, data]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        break;
        
      case 'history':
        setMessages(data.messages);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        break;
        
      case 'user_list':
        setUsers(data.users);
        break;
    }
  };

  const handleRegister = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Ошибка', 'Пароль не менее 4 символов');
      return;
    }
    setIsLoading(true);
    ws.current.send(JSON.stringify({
      type: 'register',
      username: username.trim(),
      password: password
    }));
  };

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    setIsLoading(true);
    ws.current.send(JSON.stringify({
      type: 'login',
      username: username.trim(),
      password: password
    }));
  };

  const sendMessage = () => {
    if (inputText.trim() && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'message',
        content: inputText.trim()
      }));
      setInputText('');
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => ws.current?.close();
  }, []);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <View style={styles.authForm}>
            <Text style={styles.title}>💬 {mode === 'login' ? 'Вход' : 'Регистрация'}</Text>
            
            <Text style={styles.label}>Имя</Text>
            <TextInput
              style={styles.input}
              placeholder="Введите имя"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!isLoading}
            />
            
            <Text style={styles.label}>Пароль</Text>
            <TextInput
              style={styles.input}
              placeholder="Введите пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
            
            <TouchableOpacity
              style={styles.authButton}
              onPress={mode === 'login' ? handleLogin : handleRegister}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.authButtonText}>
                  {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setPassword('');
              }}
              disabled={isLoading}>
              <Text style={styles.switchModeText}>
                {mode === 'login'
                  ? 'Нет аккаунта? Зарегистрироваться'
                  : 'Уже есть аккаунт? Войти'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Чат</Text>
        <Text style={styles.userCount}>👥 {users.length}</Text>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.message,
            item.isSystem && styles.systemMessage
          ]}>
            {!item.isSystem && (
              <Text style={styles.messageUsername}>{item.username}</Text>
            )}
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
        contentContainerStyle={styles.messagesList}
      />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Сообщение..."
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>📤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  authContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#667eea', padding: 20 },
  authForm: { backgroundColor: 'white', padding: 30, borderRadius: 15, width: '100%', maxWidth: 400 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#333' },
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, marginBottom: 20, fontSize: 16, backgroundColor: '#f9f9f9' },
  authButton: { backgroundColor: '#007bff', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  switchModeButton: { marginTop: 20, alignItems: 'center' },
  switchModeText: { color: '#007bff', fontSize: 14 },
  header: { backgroundColor: '#007bff', padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  userCount: { color: 'white', fontSize: 14 },
  messagesList: { padding: 10 },
  message: { padding: 12, marginBottom: 10, backgroundColor: 'white', borderRadius: 15, marginHorizontal: 10, maxWidth: '85%', alignSelf: 'flex-start' },
  systemMessage: { backgroundColor: '#f0f0f0', alignSelf: 'center', maxWidth: '90%' },
  messageUsername: { fontWeight: 'bold', color: '#007bff', marginBottom: 4 },
  messageText: { fontSize: 14, color: '#333' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee' },
  inputField: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 25, paddingHorizontal: 15, marginRight: 10, fontSize: 16, backgroundColor: '#f9f9f9' },
  sendButton: { backgroundColor: '#007bff', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: 'white', fontSize: 20 },
});

export default App;