import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller, UseFormReturn } from 'react-hook-form';

interface ReviewCardProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (data: { remark: string }) => void;
  heading: string; // New prop for customizable heading
}

interface FormData {
  remark: string;
}

const ReviewCard = ({ visible, onCancel, onConfirm, heading }: ReviewCardProps) => {
  const { control, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    defaultValues: {
      remark: '',
    },
  });

  useEffect(() => {
    if (!visible) {
      reset({ remark: '' });
    }
  }, [visible, reset]);

  const onSubmit = (data: FormData) => {
    Keyboard.dismiss(); // Dismiss keyboard when submitting
    console.log('Submitting remark:', data.remark);
    onConfirm(data);
  };

  const handleCancel = () => {
    Keyboard.dismiss(); // Dismiss keyboard when canceling
    onCancel();
  };

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <View className="bg-white rounded-xl p-8 w-4/5 shadow-md">
          <Text className="text-lg font-light mb-3 text-gray-800">{heading}</Text>
          <Controller
            control={control}
            name="remark"
            rules={{ required: 'Remarks are required' }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`rounded-lg p-2 min-h-[150px] font-light text-top bg-gray-100 mb-4 ${errors.remark ? 'border-red-500' : ''}`}
                placeholder="Enter remarks"
                value={value}
                onChangeText={onChange}
                multiline
                style={{ textAlignVertical: 'top' }}
              />
            )}
          />
          {errors.remark && <Text className="text-red-500 text-xs mb-2">{errors.remark.message}</Text>}
          <View className="flex-row justify-center items-center gap-6">
            <TouchableOpacity
              className="bg-white border border-[#1B85F3] w-2/5 py-4 rounded-lg justify-center items-center"
              onPress={handleCancel}
            >
              <Text className="text-[#1B85F3] font-light">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-[#1B85F3] rounded-lg w-2/5 justify-center items-center py-4"
              onPress={handleSubmit(onSubmit)}
            >
              <Text className="text-white font-light">Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ReviewCard;